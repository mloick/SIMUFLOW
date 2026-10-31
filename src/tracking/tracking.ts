/**
 * Suivre un process en vrai : une demande réelle avance d'étape en étape. Pour
 * chaque étape, on note quand elle commence, son échéance (début + délai, en
 * jours ouvrés, voir calendar.ts) et quand elle est terminée. À une décision,
 * on choisit la branche, comme dans la simulation.
 *
 * Chaque fonction prend un suivi et renvoie le nouveau, sans rien modifier.
 * Les dates sont des chaînes ISO, pour être enregistrées telles quelles.
 */

import type { Link, Process, Step } from '@/domain';

import { addWorkingDays, nextWorkingMoment } from './calendar';

export type TrackedStep = {
  stepId: string;
  /** Lien emprunté pour arriver à cette étape (absent pour la première). */
  linkId?: string;
  startedAt: string;
  /** Échéance : absente si l'étape n'a pas de délai. */
  dueAt?: string;
  doneAt?: string;
};

export type Tracking = {
  id: string;
  processId: string;
  /** Nom de la demande suivie (« Demande du 31/10 »). */
  label: string;
  startedAt: string;
  steps: TrackedStep[];
  /** Fin atteinte (ou étape sans suite terminée) : la demande est close. */
  finishedAt?: string;
};

export type StepTiming = 'none' | 'on-time' | 'soon' | 'late';

/** Une étape « arrive à échéance bientôt » dans les 4 dernières heures de travail. */
export const SOON_DAYS = 0.5;

function enter(process: Process, stepId: string, now: Date, linkId?: string): TrackedStep {
  const step = process.steps.find((item) => item.id === stepId);
  const startedAt = nextWorkingMoment(now);
  const tracked: TrackedStep = { stepId, startedAt: now.toISOString() };
  if (linkId) tracked.linkId = linkId;
  if (step?.duration !== undefined && step.duration > 0) {
    tracked.dueAt = addWorkingDays(startedAt, step.duration).toISOString();
  }
  return tracked;
}

/** Commence le suivi au départ du process (le premier départ, sinon la première étape). */
export function startTracking(process: Process, now: Date, id: string, label: string): Tracking | null {
  const first = process.steps.find((step) => step.kind === 'start') ?? process.steps[0];
  if (!first) return null;
  return { id, processId: process.id, label, startedAt: now.toISOString(), steps: [enter(process, first.id, now)] };
}

/** L'étape en cours (la dernière, tant que la demande n'est pas close). */
export function currentStep(tracking: Tracking): TrackedStep | undefined {
  return tracking.finishedAt ? undefined : tracking.steps.at(-1);
}

/** Les suites possibles de l'étape en cours. */
export function nextChoices(process: Process, tracking: Tracking): Link[] {
  const current = currentStep(tracking);
  return current ? process.links.filter((link) => link.from === current.stepId) : [];
}

/**
 * Termine l'étape en cours. Avec `linkId`, la demande passe à l'étape suivante
 * par ce lien ; sans suite possible, la demande est close.
 */
export function completeStep(process: Process, tracking: Tracking, now: Date, linkId?: string): Tracking {
  const current = currentStep(tracking);
  if (!current) return tracking;
  const done = { ...current, doneAt: now.toISOString() };
  const steps = [...tracking.steps.slice(0, -1), done];
  const choices = nextChoices(process, tracking);
  const link = choices.find((item) => item.id === linkId) ?? (choices.length === 1 ? choices[0] : undefined);
  if (!link) {
    if (choices.length > 1) return tracking; // à une décision, il faut choisir la branche
    return { ...tracking, steps, finishedAt: now.toISOString() };
  }
  return { ...tracking, steps: [...steps, enter(process, link.to, now, link.id)] };
}

/** Où en est une étape par rapport à son échéance. */
export function timingOf(step: TrackedStep, now: Date): StepTiming {
  if (!step.dueAt) return 'none';
  const due = new Date(step.dueAt).getTime();
  const end = step.doneAt ? new Date(step.doneAt).getTime() : now.getTime();
  if (end > due) return 'late';
  if (step.doneAt) return 'on-time';
  const soon = addWorkingDays(now, SOON_DAYS).getTime();
  return soon >= due ? 'soon' : 'on-time';
}

/** L'étape du process suivie (pour son titre, son acteur). */
export function stepOf(process: Process, tracked: TrackedStep): Step | undefined {
  return process.steps.find((step) => step.id === tracked.stepId);
}
