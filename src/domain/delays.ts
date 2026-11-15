/**
 * Mode Délais (SLA / OLA) : les règles, sans dates ni écran.
 *
 * - L'OLA est le délai d'une étape pour son équipe (`Step.duration`).
 * - Le SLA est le délai promis au client pour tout le process (`Process.sla`).
 *
 * Un délai passe du vert (« dans les temps ») à l'orange (« bientôt dépassé »,
 * les trois quarts du délai sont consommés) puis au rouge (« dépassé »).
 * Fonctions pures, testées dans __tests__/delays.test.ts.
 */

import type { Process } from './types';

export type DelayLevel = 'ok' | 'warning' | 'late';

/** Part du délai consommée à partir de laquelle on passe à l'orange (et on prévient). */
export const WARNING_RATIO = 0.75;

/** Le niveau d'un délai : `used` jours consommés sur `budget` jours prévus. */
export function delayLevel(used: number, budget: number): DelayLevel {
  if (used > budget) return 'late';
  if (used >= budget * WARNING_RATIO) return 'warning';
  return 'ok';
}

/** Part consommée, entre 0 et 1 (pour une barre de progression). */
export function delayRatio(used: number, budget: number): number {
  if (!(budget > 0)) return used > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, used / budget));
}

/** Le SLA du process, s'il en a un (un SLA nul ou négatif n'en est pas un). */
export function slaOf(process: Process): number | undefined {
  return process.sla !== undefined && process.sla > 0 ? process.sla : undefined;
}

/** Vrai si le process a un SLA ou au moins une étape avec un OLA : le mode Délais a quelque chose à montrer. */
export function hasDelays(process: Process): boolean {
  return slaOf(process) !== undefined || process.steps.some((step) => (step.duration ?? 0) > 0);
}

/** Le process avec un nouveau SLA ; `null` (ou une valeur invalide) le retire. */
export function setSla(process: Process, sla: number | null): Process {
  const next = { ...process };
  if (sla === null || !(sla > 0)) delete next.sla;
  else next.sla = sla;
  return next;
}
