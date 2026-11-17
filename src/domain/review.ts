/**
 * Relecture d'un process partagé par un membre : quelles étapes sont « sa
 * partie », et où il en est. Fonctions pures, testées dans __tests__/review.test.ts.
 */

import { getT, type Messages } from '@/i18n';

import type { Process, Step } from './types';

/** Avis sur une étape : validée telle quelle, ou à revoir (avec un commentaire). */
export type ReviewStatus = 'valide' | 'a_revoir';

export type StepReview = {
  stepId: string;
  status: ReviewStatus;
  comment: string | null;
};

/** Au-delà, un commentaire devient une conversation : ce n'est pas le but. */
export const MAX_COMMENT = 1000;

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Les étapes à relire : départ et fin exclus (rien à valider). */
export function reviewableSteps(process: Process): Step[] {
  return process.steps.filter((step) => step.kind !== 'start' && step.kind !== 'end');
}

/**
 * Les étapes de l'acteur confié au membre (« Achats » = « achats »). Sans
 * acteur confié, ou si l'acteur n'a plus d'étape, tout le process est à relire.
 */
export function myPartSteps(process: Process, actor: string | null | undefined): Step[] {
  const steps = reviewableSteps(process);
  if (!actor?.trim()) return steps;
  const wanted = normalize(actor);
  return steps.filter((step) => step.actor && normalize(step.actor) === wanted);
}

/**
 * Puis-je donner mon avis sur cette étape ? Seulement sur ma partie ; sans
 * acteur confié, ou si l'acteur n'a plus d'étape, sur tout le process. Les
 * étapes des autres restent lisibles. Même règle sur le serveur
 * (supabase/migrations/20261124000000_avis_sa_partie.sql).
 */
export function canReviewStep(process: Process, actor: string | null | undefined, stepId: string): boolean {
  if (!reviewableSteps(process).some((step) => step.id === stepId)) return false;
  const mine = myPartSteps(process, actor);
  return !actor?.trim() || mine.length === 0 || mine.some((step) => step.id === stepId);
}

/** Où en est la relecture d'une liste d'étapes. */
export function reviewProgress(steps: Step[], reviews: StepReview[]) {
  const byStep = new Map(reviews.map((review) => [review.stepId, review]));
  let validated = 0;
  let toRevise = 0;
  for (const step of steps) {
    const status = byStep.get(step.id)?.status;
    if (status === 'valide') validated += 1;
    else if (status === 'a_revoir') toRevise += 1;
  }
  return {
    total: steps.length,
    validated,
    toRevise,
    pending: steps.length - validated - toRevise,
    done: steps.length > 0 && validated + toRevise === steps.length,
  };
}

/** Problème d'un avis avant envoi, ou `null` s'il est bon. */
export function reviewProblem(status: ReviewStatus, comment: string, t: Messages = getT()): string | null {
  if (comment.length > MAX_COMMENT) return t.review.commentTooLong(MAX_COMMENT);
  if (status === 'a_revoir' && !comment.trim()) return t.review.commentRequired;
  return null;
}
