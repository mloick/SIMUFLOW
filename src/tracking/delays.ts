/**
 * Mode Délais d'une demande suivie : le chrono du SLA (tout le process, promis
 * au client) et celui de l'OLA (l'étape en cours, pour son équipe), en temps
 * de travail (jours ouvrés de 8 h, voir calendar.ts), puis le bilan à la fin.
 *
 * Vert tant qu'il reste plus d'un quart du délai, orange ensuite, rouge une
 * fois l'échéance passée (`delayLevel`, src/domain/delays.ts). Fonctions
 * pures, testées dans __tests__/delays.test.ts.
 */

import { delayLevel, delayRatio, WARNING_RATIO, type DelayLevel } from '@/domain';

import { addWorkingDays, nextWorkingMoment, WORKDAY_HOURS, workingMinutesBetween } from './calendar';
import type { TrackedStep, Tracking } from './tracking';

/** Jours ouvrés exacts entre deux moments (le chrono a besoin des minutes, pas d'un arrondi au dixième). */
const daysBetween = (from: Date, to: Date) => workingMinutesBetween(from, to) / (WORKDAY_HOURS * 60);

export type DelayClock = {
  level: DelayLevel;
  /** Jours ouvrés restants avant l'échéance ; négatif une fois dépassée (le retard). */
  remaining: number;
  /** Part du délai consommée, entre 0 et 1, pour la barre. */
  ratio: number;
  /** Délai prévu, en jours ouvrés. */
  budget: number;
  dueAt: string;
  /** Vrai quand le chrono est arrêté (étape ou demande terminée). */
  stopped: boolean;
};

/** Le chrono d'un délai qui commence à `startedAt` et finit à `dueAt` ; `endAt` l'arrête. */
export function clockOf(startedAt: string, dueAt: string, now: Date, endAt?: string): DelayClock {
  const start = nextWorkingMoment(new Date(startedAt));
  const due = new Date(dueAt);
  const end = endAt ? new Date(endAt) : now;
  const budget = Math.max(0, daysBetween(start, due));
  const used = Math.max(0, daysBetween(start, end));
  const remaining = daysBetween(end, due);
  return {
    level: end.getTime() > due.getTime() ? 'late' : delayLevel(used, budget),
    remaining,
    ratio: delayRatio(used, budget),
    budget,
    dueAt,
    stopped: endAt !== undefined,
  };
}

/** Le chrono du SLA d'une demande, si son process avait un SLA au départ. */
export function slaClock(tracking: Tracking, now: Date): DelayClock | null {
  if (!tracking.slaDueAt) return null;
  return clockOf(tracking.startedAt, tracking.slaDueAt, now, tracking.finishedAt);
}

/** Le chrono de l'OLA d'une étape, si elle a un délai. */
export function olaClock(step: TrackedStep, now: Date): DelayClock | null {
  if (!step.dueAt) return null;
  return clockOf(step.startedAt, step.dueAt, now, step.doneAt);
}

/** Le moment où un délai passe à l'orange : les trois quarts consommés. */
export function warningMoment(startedAt: string, budget: number): Date {
  return addWorkingDays(nextWorkingMoment(new Date(startedAt)), budget * WARNING_RATIO);
}

/** Temps de travail restant découpé pour l'affichage : jours, heures, minutes (valeur absolue). */
export function splitWorkingTime(days: number): {
  days: number;
  hours: number;
  minutes: number;
} {
  const totalMinutes = Math.round(Math.abs(days) * WORKDAY_HOURS * 60);
  const perDay = WORKDAY_HOURS * 60;
  return {
    days: Math.floor(totalMinutes / perDay),
    hours: Math.floor((totalMinutes % perDay) / 60),
    minutes: totalMinutes % 60,
  };
}

export type DelayReport = {
  /** SLA de la demande, s'il y en avait un. */
  sla?: { met: boolean; budget: number; used: number; margin: number };
  /** Étapes avec un OLA : combien tenues sur combien. */
  ola: { met: number; total: number };
  /** Étapes dont l'OLA est dépassé, dans l'ordre. */
  lateSteps: string[];
  /** Durée de la demande, en jours ouvrés. */
  used: number;
};

/** Le bilan d'une demande terminée : SLA tenu ou non, OLA tenus. */
export function delayReport(tracking: Tracking): DelayReport | null {
  if (!tracking.finishedAt) return null;
  const end = new Date(tracking.finishedAt);
  const used = Math.max(0, daysBetween(nextWorkingMoment(new Date(tracking.startedAt)), end));
  const timed = tracking.steps.filter((step) => step.dueAt);
  const late = timed.filter(
    (step) => new Date(step.doneAt ?? tracking.finishedAt!).getTime() > new Date(step.dueAt!).getTime(),
  );
  const report: DelayReport = {
    ola: { met: timed.length - late.length, total: timed.length },
    lateSteps: late.map((step) => step.stepId),
    used,
  };
  if (tracking.slaDueAt && tracking.sla !== undefined) {
    const margin = daysBetween(end, new Date(tracking.slaDueAt));
    report.sla = {
      met: end.getTime() <= new Date(tracking.slaDueAt).getTime(),
      budget: tracking.sla,
      used,
      margin,
    };
  }
  return report;
}
