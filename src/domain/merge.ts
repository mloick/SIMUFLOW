/**
 * Fusion à trois versions d'un process, comme Git : quand un process a été
 * modifié à deux endroits (le téléphone hors connexion, la version web), on
 * compare trois versions :
 *
 * - la base : la dernière version que les deux connaissaient ;
 * - la mienne : celle du téléphone ;
 * - la leur : celle du serveur, modifiée ailleurs entre-temps.
 *
 * Chaque étape et chaque lien a un identifiant : on les compare un par un.
 * Pour chacun (et pour le nom, le SLA, le projet) :
 *
 * - pareil des deux côtés : on le garde ;
 * - changé d'un seul côté (ajouté, modifié ou supprimé) : on prend ce changement ;
 * - changé des deux côtés, différemment : c'est un conflit, l'app ne peut pas
 *   deviner. La synchronisation garde alors la version du serveur et enregistre
 *   la mienne comme copie (src/data/sync.ts).
 *
 * Fonctions pures, testées dans __tests__/merge.test.ts.
 */

import type { Link, Process, Project, Step } from './types';

export type MergeResult = {
  process: Process;
  /** Ce qui a changé des deux côtés : « name », « sla », « projectId », « step:<id> », « link:<id> ». Vide : fusion réussie. */
  conflicts: string[];
};

/** Égalité de deux valeurs JSON, sans tenir compte de l'ordre des clés. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  // Une clé absente et une clé `undefined` se valent (JSON les écrit pareil).
  return [...keys].every((key) => sameValue(left[key], right[key]));
}

/** Ce que le serveur garde d'un process : le reste (identifiant sur le téléphone, date de correction) ne compte pas. */
function content(process: Process) {
  return {
    name: process.name.trim(),
    source: process.source,
    steps: process.steps,
    links: process.links,
    sla: process.sla,
    projectId: process.projectId ?? null,
  };
}

/** Le process a-t-il le même contenu (nom, étapes, liens, SLA, projet) ? */
export function sameProcess(a: Process, b: Process): boolean {
  return sameValue(content(a), content(b));
}

/** Choix à trois versions pour une valeur : `ok` faux s'il y a conflit. */
function pick<T>(base: T, mine: T, theirs: T): { value: T; ok: boolean } {
  if (sameValue(mine, theirs)) return { value: mine, ok: true };
  if (sameValue(base, mine)) return { value: theirs, ok: true };
  if (sameValue(base, theirs)) return { value: mine, ok: true };
  return { value: theirs, ok: false };
}

/**
 * Fusionne deux listes d'éléments à identifiant (étapes ou liens). L'ordre est
 * celui du serveur ; les éléments ajoutés seulement sur le téléphone suivent,
 * dans leur ordre.
 */
function mergeById<T extends { id: string }>(
  kind: 'step' | 'link',
  base: T[],
  mine: T[],
  theirs: T[],
  conflicts: string[],
): T[] {
  const byId = (list: T[]) => new Map(list.map((item) => [item.id, item]));
  const b = byId(base);
  const m = byId(mine);
  const t = byId(theirs);
  const ids = [...new Set([...theirs.map((item) => item.id), ...mine.map((item) => item.id)])];
  const result: T[] = [];
  for (const id of ids) {
    const { value, ok } = pick(b.get(id), m.get(id), t.get(id));
    if (!ok) conflicts.push(`${kind}:${id}`);
    if (value) result.push(value);
  }
  return result;
}

/**
 * Fusionne ma version et celle du serveur à partir de la base. Le résultat
 * garde l'identifiant de ma version (celui du téléphone).
 */
export function mergeProcess(base: Process, mine: Process, theirs: Process): MergeResult {
  const conflicts: string[] = [];
  const field = <K extends 'name' | 'source' | 'sla'>(key: K): Process[K] => {
    const { value, ok } = pick(base[key], mine[key], theirs[key]);
    if (!ok) conflicts.push(key);
    return value;
  };
  const name = pick(base.name.trim(), mine.name.trim(), theirs.name.trim());
  if (!name.ok) conflicts.push('name');
  const project = pick(base.projectId ?? null, mine.projectId ?? null, theirs.projectId ?? null);
  if (!project.ok) conflicts.push('projectId');
  const source = field('source');
  const sla = field('sla');
  const steps: Step[] = mergeById('step', base.steps, mine.steps, theirs.steps, conflicts);
  const links: Link[] = mergeById('link', base.links, mine.links, theirs.links, conflicts);
  // La date de correction la plus récente des deux.
  const editedAt = [mine.editedAt, theirs.editedAt].filter(Boolean).sort().pop();

  const process: Process = {
    id: mine.id,
    name: name.value,
    ...(source !== undefined ? { source } : {}),
    steps,
    links,
    ...(sla !== undefined ? { sla } : {}),
    ...(editedAt ? { editedAt } : {}),
    ...(project.value !== null ? { projectId: project.value } : mine.projectId === null ? { projectId: null } : {}),
  };
  return { process, conflicts };
}

/**
 * Fusion à trois versions d'un projet : le nom et la description, champ par
 * champ. Un champ changé des deux côtés différemment garde ma version (celle
 * du téléphone qui se synchronise), comme avant cette fusion : un projet n'a
 * pas d'étapes, et le dupliquer pour un nom n'aurait pas de sens.
 */
export function mergeProject(base: Project, mine: Project, theirs: Project): Project {
  const field = (key: 'name' | 'description') => {
    const b = base[key]?.trim() || undefined;
    const m = mine[key]?.trim() || undefined;
    const t = theirs[key]?.trim() || undefined;
    return m === t || b !== m ? m : t;
  };
  const description = field('description');
  return {
    id: mine.id,
    createdAt: mine.createdAt,
    name: field('name') ?? mine.name,
    ...(description ? { description } : {}),
  };
}

/** Le projet a-t-il le même nom et la même description ? */
export function sameProject(a: Project, b: Project): boolean {
  return a.name.trim() === b.name.trim() && (a.description?.trim() || '') === (b.description?.trim() || '');
}
