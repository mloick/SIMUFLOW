/**
 * Suivi de la validation d'un process partagé, côté propriétaire : où en est
 * chaque membre, et ce que disent les avis sur chaque étape. Fonctions pures,
 * testées dans __tests__/validation.test.ts.
 */

import { myPartSteps, reviewableSteps, reviewProgress, type ReviewStatus } from './review';
import type { Process, Step } from './types';

/** Un membre du process, tel que le propriétaire le voit. */
export type ValidationMember = { id: string; name: string; actor: string | null };

/** L'avis d'un membre sur une étape. */
export type MemberReview = { memberId: string; stepId: string; status: ReviewStatus; comment: string | null };

export type MemberProgress = {
  member: ValidationMember;
  total: number;
  validated: number;
  toRevise: number;
  pending: number;
  state: 'termine' | 'en_cours' | 'pas_commence';
};

export type StepFeedback = {
  step: Step;
  /** Membres qui ont validé l'étape. */
  validatedBy: ValidationMember[];
  /** Membres qui l'ont signalée à revoir, avec leur commentaire. */
  toRevise: { member: ValidationMember; comment: string }[];
};

export type ValidationOverview = {
  members: MemberProgress[];
  steps: StepFeedback[];
  /** Membres qui ont relu toute leur partie. */
  doneCount: number;
  /** Étapes signalées à revoir par au moins un membre. */
  toReviseCount: number;
  /** Tous les membres ont tout relu, et personne n'a rien à revoir. */
  fullyValidated: boolean;
};

export function validationOverview(
  process: Process,
  members: ValidationMember[],
  reviews: MemberReview[],
): ValidationOverview {
  const progress = members.map((member): MemberProgress => {
    const steps = myPartSteps(process, member.actor);
    // Un acteur qui n'a plus d'étape : le membre relit tout le process (comme dans « Ma partie »).
    const part = member.actor && steps.length === 0 ? reviewableSteps(process) : steps;
    const mine = reviews
      .filter((review) => review.memberId === member.id)
      .map(({ stepId, status, comment }) => ({ stepId, status, comment }));
    const { total, validated, toRevise, pending, done } = reviewProgress(part, mine);
    const state = done ? 'termine' : validated + toRevise > 0 ? 'en_cours' : 'pas_commence';
    return { member, total, validated, toRevise, pending, state };
  });

  const byId = new Map(members.map((member) => [member.id, member]));
  const steps = reviewableSteps(process).map((step): StepFeedback => {
    const about = reviews.filter((review) => review.stepId === step.id && byId.has(review.memberId));
    return {
      step,
      validatedBy: about.filter((review) => review.status === 'valide').map((review) => byId.get(review.memberId)!),
      toRevise: about
        .filter((review) => review.status === 'a_revoir')
        .map((review) => ({ member: byId.get(review.memberId)!, comment: review.comment ?? '' })),
    };
  });

  const doneCount = progress.filter((item) => item.state === 'termine').length;
  const toReviseCount = steps.filter((item) => item.toRevise.length > 0).length;
  return {
    members: progress,
    steps,
    doneCount,
    toReviseCount,
    fullyValidated: members.length > 0 && doneCount === members.length && toReviseCount === 0,
  };
}
