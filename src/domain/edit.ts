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
