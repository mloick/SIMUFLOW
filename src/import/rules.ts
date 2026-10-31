/**
 * Règles de lecture apprises : quand l'utilisateur corrige un process importé,
 * SimuFlow retient ce qui vaut pour tout le schéma, et le refait seul aux
 * imports suivants.
 *
 * - « acteur » : toutes les étapes lues avec l'acteur A ont reçu l'acteur B
 *   (un service renommé, une abréviation développée).
 * - « rôle » : toutes les étapes d'une même forme ont reçu le même rôle
 *   (par exemple, chez cet utilisateur, un hexagone est une décision).
 *
 * Une correction faite sur une seule étape parmi d'autres semblables reste
 * une correction ponctuelle : elle n'apprend rien.
 */

import type { Process, StepKind } from '@/domain';

export type ReadingRule = { type: 'actor'; from: string; to: string } | { type: 'role'; shape: string; role: StepKind };

const key = (text: string) => text.trim().toLocaleLowerCase('fr');

/** Identité d'une règle : une nouvelle règle sur le même acteur ou la même forme remplace l'ancienne. */
const ruleKey = (rule: ReadingRule) => (rule.type === 'actor' ? `actor|${key(rule.from)}` : `role|${rule.shape}`);

/** Formes de base : il en faut plusieurs, toutes corrigées pareil, pour en tirer une règle. */
const BASIC_SHAPES = new Set(['rectangle', 'rounded']);

/** Ce que les corrections de `before` à `after` apprennent (étapes comparées par identifiant). */
export function learnRules(before: Process, after: Process): ReadingRule[] {
  const edited = new Map(after.steps.map((step) => [step.id, step]));
  const pairs = before.steps.flatMap((step) => {
    const next = edited.get(step.id);
    return next ? [{ before: step, after: next }] : [];
  });
  const rules: ReadingRule[] = [];

  // Acteurs : toutes les étapes de l'acteur A ont reçu un même acteur B.
  const byActor = new Map<string, typeof pairs>();
  for (const pair of pairs) {
    if (!pair.before.actor?.trim()) continue;
    const group = byActor.get(key(pair.before.actor)) ?? [];
    byActor.set(key(pair.before.actor), [...group, pair]);
  }
  for (const group of byActor.values()) {
    const targets = new Set(group.map((pair) => pair.after.actor?.trim() ?? ''));
    const [to] = [...targets];
    if (targets.size === 1 && to && key(to) !== key(group[0].before.actor!)) {
      rules.push({ type: 'actor', from: group[0].before.actor!.trim(), to });
    }
  }

  // Rôles : toutes les étapes d'une forme ont changé de rôle, et toutes pour le même.
  const byShape = new Map<string, typeof pairs>();
  for (const pair of pairs) {
    if (!pair.before.shape) continue;
    byShape.set(pair.before.shape, [...(byShape.get(pair.before.shape) ?? []), pair]);
  }
  for (const [shape, group] of byShape) {
    const roles = new Set(group.map((pair) => pair.after.kind));
    const [role] = [...roles];
    const allChanged = group.every((pair) => pair.after.kind !== pair.before.kind);
    const enough = !BASIC_SHAPES.has(shape) || group.length >= 2;
    if (roles.size === 1 && allChanged && enough) rules.push({ type: 'role', shape, role });
  }
  return rules;
}

/** Ajoute des règles : une règle sur le même acteur ou la même forme remplace l'ancienne. */
export function mergeRules(existing: ReadingRule[], learned: ReadingRule[]): ReadingRule[] {
  const replaced = new Set(learned.map(ruleKey));
  return [...existing.filter((rule) => !replaced.has(ruleKey(rule))), ...learned];
}

/** Applique les règles à un process lu. Renvoie le process et la phrase de chaque règle qui a servi. */
export function applyRules(process: Process, rules: ReadingRule[]): { process: Process; applied: string[] } {
  const used = new Set<ReadingRule>();
  const steps = process.steps.map((step) => {
    let next = step;
    for (const rule of rules) {
      if (rule.type === 'actor' && next.actor && key(next.actor) === key(rule.from) && next.actor !== rule.to) {
        next = { ...next, actor: rule.to };
        used.add(rule);
      } else if (rule.type === 'role' && next.shape === rule.shape && next.kind !== rule.role) {
        next = { ...next, kind: rule.role };
        used.add(rule);
      }
    }
    return next;
  });
  if (used.size === 0) return { process, applied: [] };
  return { process: { ...process, steps }, applied: rules.filter((rule) => used.has(rule)).map(describeRule) };
}

const SHAPE_NAMES: Record<string, string> = {
  rhombus: 'losange',
  ellipse: 'ellipse',
  triangle: 'triangle',
  hexagon: 'hexagone',
  cloud: 'nuage',
  cylinder: 'cylindre',
  parallelogram: 'parallélogramme',
  trapezoid: 'trapèze',
  text: 'texte seul',
  rectangle: 'rectangle',
  rounded: 'rectangle arrondi',
  process: 'rectangle à bords doubles',
  document: 'document',
  step: 'flèche',
};

const ROLE_NAMES: Record<StepKind, string> = {
  start: 'un départ',
  task: 'une tâche',
  decision: 'une décision',
  end: 'une fin',
};

/** Nom lisible d'une forme : « hexagone », ou le nom draw.io sans préfixe (« mxgraph.flowchart.delay » → « delay »). */
export function shapeName(shape: string): string {
  return SHAPE_NAMES[shape] ?? shape.split('.').pop() ?? shape;
}

/** Phrase d’une règle : « Acteur « Serv. compta » lu comme « Comptabilité » », « Forme hexagone lue comme une décision ». */
export function describeRule(rule: ReadingRule): string {
  if (rule.type === 'actor') return `Acteur « ${rule.from} » lu comme « ${rule.to} »`;
  const name = shapeName(rule.shape);
  return `Forme ${name} lue comme ${ROLE_NAMES[rule.role]}`;
}

/** Relit une liste de règles enregistrée ; ignore ce qui est mal formé. */
export function parseRules(value: unknown): ReadingRule[] {
  if (!Array.isArray(value)) return [];
  const kinds: StepKind[] = ['start', 'task', 'decision', 'end'];
  return value.filter(
    (rule): rule is ReadingRule =>
      (rule?.type === 'actor' && typeof rule.from === 'string' && typeof rule.to === 'string') ||
      (rule?.type === 'role' && typeof rule.shape === 'string' && kinds.includes(rule.role)),
  );
}
