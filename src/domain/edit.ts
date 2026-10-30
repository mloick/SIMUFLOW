/**
 * Modifications d'un process, pour l'éditeur : chaque fonction renvoie un
 * nouveau process, sans toucher à l'ancien (l'écran peut annuler).
 */

import type { Process, Step, StepKind } from './types';

export type StepChanges = {
  title?: string;
  /** Chaîne vide : plus d'acteur. */
  actor?: string;
  /** `null` : plus de délai. */
  duration?: number | null;
  kind?: StepKind;
};

/** Modifie une étape : titre, acteur, délai, rôle. */
export function updateStep(process: Process, stepId: string, changes: StepChanges): Process {
  return {
    ...process,
    steps: process.steps.map((step) => {
      if (step.id !== stepId) return step;
      const next: Step = { ...step };
      if (changes.title !== undefined) next.title = changes.title.trim() || step.title;
      if (changes.kind !== undefined) next.kind = changes.kind;
      if (changes.actor !== undefined) {
        const actor = changes.actor.trim();
        if (actor) next.actor = actor;
        else delete next.actor;
      }
      if (changes.duration !== undefined) {
        if (changes.duration === null || !(changes.duration >= 0)) delete next.duration;
        else next.duration = changes.duration;
      }
      return next;
    }),
  };
}

/** Renomme une branche (lien) ; un nom vide la laisse sans nom. */
export function renameLink(process: Process, linkId: string, label: string): Process {
  return {
    ...process,
    links: process.links.map((link) => {
      if (link.id !== linkId) return link;
      const trimmed = label.trim();
      const next = { ...link };
      if (trimmed) next.label = trimmed;
      else delete next.label;
      return next;
    }),
  };
}

/**
 * Fait d'une étape une décision, et nomme ses branches sans nom d'après
 * l'étape où elles mènent (« Payer », « Faire viser »…).
 */
export function makeDecision(process: Process, stepId: string): Process {
  const titles = new Map(process.steps.map((step) => [step.id, step.title]));
  const next = updateStep(process, stepId, { kind: 'decision' });
  return {
    ...next,
    links: next.links.map((link) =>
      link.from === stepId && !link.label?.trim() ? { ...link, label: titles.get(link.to) || 'Autre cas' } : link,
    ),
  };
}

/** Acteurs déjà présents dans le process, pour les proposer dans l'éditeur. */
export function actorsOf(process: Process): string[] {
  return [...new Set(process.steps.map((step) => step.actor).filter((actor): actor is string => !!actor))];
}

/** Identifiant libre dans le process : « etape-1 », « etape-2 »… */
function freeId(taken: Set<string>, prefix: string): string {
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

/**
 * Ajoute une étape après une autre. Si celle-ci n'avait qu'une suite, la
 * nouvelle s'insère entre les deux ; sinon elle devient une suite de plus.
 * Renvoie le process et l'identifiant de la nouvelle étape.
 */
export function addStepAfter(process: Process, afterId: string, title: string): { process: Process; stepId: string } {
  const stepId = freeId(new Set(process.steps.map((step) => step.id)), 'etape');
  const linkIds = new Set(process.links.map((link) => link.id));
  const exits = process.links.filter((link) => link.from === afterId);
  const step: Step = { id: stepId, kind: 'task', title: title.trim() || 'Nouvelle étape' };
  const at = process.steps.findIndex((other) => other.id === afterId);
  const steps = [...process.steps];
  steps.splice(at < 0 ? steps.length : at + 1, 0, step);

  let links = process.links;
  if (exits.length === 1) {
    // Entre les deux : « après » → nouvelle → ancienne suite, le nom de branche reste au départ.
    const [exit] = exits;
    links = links.map((link) => (link.id === exit.id ? { ...link, to: stepId } : link));
    links = [...links, { id: freeId(linkIds, 'lien'), from: stepId, to: exit.to }];
  } else {
    links = [...links, { id: freeId(linkIds, 'lien'), from: afterId, to: stepId }];
  }
  return { process: { ...process, steps, links }, stepId };
}

/**
 * Ajoute un cas (une branche nommée) à une étape : vers une étape existante
 * (`toId`), ou vers une nouvelle étape qui porte le nom du cas.
 */
export function addBranch(process: Process, fromId: string, label: string, toId?: string): Process {
  const linkIds = new Set(process.links.map((link) => link.id));
  const name = label.trim();
  let next = process;
  let target = toId;
  if (!target) {
    target = freeId(new Set(process.steps.map((step) => step.id)), 'etape');
    const at = process.steps.findIndex((step) => step.id === fromId);
    const steps = [...process.steps];
    steps.splice(at < 0 ? steps.length : at + 1, 0, { id: target, kind: 'task', title: name || 'Nouveau cas' });
    next = { ...process, steps };
  }
  const link = { id: freeId(linkIds, 'lien'), from: fromId, to: target, ...(name ? { label: name } : {}) };
  return { ...next, links: [...next.links, link] };
}

/** Retire une branche (un lien). */
export function removeLink(process: Process, linkId: string): Process {
  return { ...process, links: process.links.filter((link) => link.id !== linkId) };
}

/**
 * Supprime une étape et ses liens. Si elle était un simple passage (une entrée,
 * une sortie), l'étape d'avant est reliée directement à celle d'après.
 */
export function removeStep(process: Process, stepId: string): Process {
  const incoming = process.links.filter((link) => link.to === stepId);
  const outgoing = process.links.filter((link) => link.from === stepId);
  let links = process.links.filter((link) => link.from !== stepId && link.to !== stepId);
  if (incoming.length === 1 && outgoing.length === 1 && incoming[0].from !== outgoing[0].to) {
    links = [...links, { ...incoming[0], to: outgoing[0].to }];
  }
  return { ...process, steps: process.steps.filter((step) => step.id !== stepId), links };
}
