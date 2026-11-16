/**
 * Suivre un process en vrai : une demande réelle avance d'étape en étape. Pour
 * chaque étape, on note quand elle commence, son échéance (début + délai, en
 * jours ouvrés, voir calendar.ts) et quand elle est terminée. À une décision,
 * on choisit la branche, comme dans la simulation.
 *
 * Chaque fonction prend un suivi et renvoie le nouveau, sans rien modifier.
 * Les dates sont des chaînes ISO, pour être enregistrées telles quelles.
 *
 * Tâches en parallèle : après une étape « En parallèle » qui partage, toutes
 * ses branches commencent en même temps ; il y a alors plusieurs étapes en
 * cours, chacune avec son échéance (OLA). Une branche qui arrive à une
 * jonction y attend (`waiting`) ; quand la dernière arrive, la suite commence.
 * Sans étape « En parallèle », il n'y a jamais qu'une étape en cours, la
 * dernière, exactement comme avant.
 */

import { slaOf, type Link, type Process, type Step } from '@/domain';

import { addWorkingDays, nextWorkingMoment } from './calendar';

export type TrackedStep = {
  stepId: string;
  /** Lien emprunté pour arriver à cette étape (absent pour la première). */
  linkId?: string;
  startedAt: string;
  /** Échéance : absente si l'étape n'a pas de délai. */
  dueAt?: string;
  doneAt?: string;
  /** Tâches en parallèle : branche arrivée à une jonction, qui attend les autres. */
  waiting?: boolean;
};

export type Tracking = {
  id: string;
  processId: string;
  /** Nom de la demande suivie (« Demande du 31/10 »). */
  label: string;
  startedAt: string;
  /** SLA du process au départ, en jours ouvrés (mode Délais) : gardé tel quel même si le process change ensuite. */
  sla?: number;
  /** Échéance du SLA : départ + SLA, en jours ouvrés. */
  slaDueAt?: string;
  steps: TrackedStep[];
  /** Fin atteinte (ou étape sans suite terminée) : la demande est close. */
  finishedAt?: string;
  /** Réponses du formulaire qui a lancé la demande (simulation d'un formulaire). */
  answers?: { label: string; answer: string }[];
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
  const tracking: Tracking = {
    id,
    processId: process.id,
    label,
    startedAt: now.toISOString(),
    steps: [enter(process, first.id, now)],
  };
  const sla = slaOf(process);
  if (sla !== undefined) {
    tracking.sla = sla;
    tracking.slaDueAt = addWorkingDays(nextWorkingMoment(now), sla).toISOString();
  }
  return tracking;
}

/** Les étapes en cours : une seule sans tâches en parallèle, une par branche sinon. */
export function currentSteps(tracking: Tracking): TrackedStep[] {
  return tracking.finishedAt ? [] : tracking.steps.filter((step) => !step.doneAt && !step.waiting);
}

/** L'étape en cours (la première des branches en cours ; sans parallèle, la dernière étape). */
export function currentStep(tracking: Tracking): TrackedStep | undefined {
  return currentSteps(tracking)[0];
}

/** Les suites possibles d'une étape en cours (par défaut, `currentStep`). */
export function nextChoices(process: Process, tracking: Tracking, tracked = currentStep(tracking)): Link[] {
  return tracked ? process.links.filter((link) => link.from === tracked.stepId) : [];
}

/** Branches arrivées à une jonction, qui attendent les autres. */
export function waitingSteps(tracking: Tracking): TrackedStep[] {
  return tracking.finishedAt ? [] : tracking.steps.filter((step) => step.waiting);
}

/**
 * Entre dans une étape par un lien et renvoie les étapes à ajouter au suivi.
 * Une étape ordinaire commence. Une jonction (« En parallèle » à plusieurs
 * entrées) note la branche qui attend, ou, si c'est la dernière, libère celles
 * qui attendaient et continue. Un partage (« En parallèle » à plusieurs
 * sorties) est passé aussitôt, et chaque branche commence.
 */
function enterAll(process: Process, steps: TrackedStep[], stepId: string, now: Date, linkId?: string): TrackedStep[] {
  const step = process.steps.find((item) => item.id === stepId);
  if (step?.kind !== 'parallel') return [...steps, enter(process, stepId, now, linkId)];
  const at = now.toISOString();
  const arrival: TrackedStep = {
    stepId,
    startedAt: at,
    ...(linkId ? { linkId } : {}),
  };
  const expected = process.links.filter((link) => link.to === stepId).length;
  if (expected >= 2) {
    const waiting = steps.filter((item) => item.waiting && item.stepId === stepId).length;
    if (waiting + 1 < expected) return [...steps, { ...arrival, waiting: true }];
    // Dernière branche arrivée : celles qui attendaient sont libérées.
    steps = steps.map((item) =>
      item.waiting && item.stepId === stepId
        ? {
            stepId,
            startedAt: item.startedAt,
            ...(item.linkId ? { linkId: item.linkId } : {}),
            doneAt: at,
          }
        : item,
    );
  }
  let next = [...steps, { ...arrival, doneAt: at }];
  for (const exit of process.links.filter((link) => link.from === stepId)) {
    next = enterAll(process, next, exit.to, now, exit.id);
  }
  return next;
}

/**
 * Termine une étape en cours (par défaut `currentStep`, sinon celle d'indice
 * `index` dans `tracking.steps`). Avec `linkId`, sa branche passe à l'étape
 * suivante par ce lien ; sans suite possible, la branche s'arrête. La demande
 * est close quand plus aucune étape n'est en cours.
 */
export function completeStep(
  process: Process,
  tracking: Tracking,
  now: Date,
  linkId?: string,
  index?: number,
): Tracking {
  const at = index ?? tracking.steps.indexOf(currentStep(tracking)!);
  const current = tracking.steps[at];
  if (tracking.finishedAt || !current || current.doneAt || current.waiting) return tracking;
  const done = { ...current, doneAt: now.toISOString() };
  let steps = tracking.steps.map((step, position) => (position === at ? done : step));
  const choices = nextChoices(process, tracking, current);
  const link = choices.find((item) => item.id === linkId) ?? (choices.length === 1 ? choices[0] : undefined);
  if (!link && choices.length > 1) return tracking; // à une décision, il faut choisir la branche
  if (link) steps = enterAll(process, steps, link.to, now, link.id);
  const next = { ...tracking, steps };
  return currentSteps(next).length === 0 ? { ...next, finishedAt: now.toISOString() } : next;
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
