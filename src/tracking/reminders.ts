/**
 * Rappels d'échéance d'une demande suivie : pour l'étape en cours, s'il y a une
 * échéance,
 *
 * - le jour de l'échéance à 9 h : « Aujourd'hui : Commander, échéance à 14:00 » ;
 * - à l'échéance : « En retard : Commander devait être terminée à 14:00 ».
 *
 * Un rappel déjà passé n'est pas programmé. Quand l'étape est terminée, ses
 * rappels disparaissent (on reprogramme tout à chaque changement). Fonctions
 * pures, testées dans __tests__/reminders.test.ts.
 */

import type { Process } from '@/domain';

import { WORKDAY_START_HOUR } from './calendar';
import { currentStep, stepOf, type Tracking } from './tracking';

export type Reminder = {
  /** Identifiant stable : le même rappel reprogrammé remplace l'ancien. */
  id: string;
  date: Date;
  title: string;
  body: string;
  trackingId: string;
};

const time = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Les rappels à venir d'une demande suivie. */
export function remindersFor(process: Process, tracking: Tracking, now: Date): Reminder[] {
  const current = currentStep(tracking);
  if (!current?.dueAt) return [];
  const due = new Date(current.dueAt);
  const title = stepOf(process, current)?.title || 'Étape sans titre';
  const index = tracking.steps.length - 1;
  const morning = new Date(due.getFullYear(), due.getMonth(), due.getDate(), WORKDAY_START_HOUR);
  const reminders: Reminder[] = [];
  if (morning < due) {
    reminders.push({
      id: `${tracking.id}-${index}-jour`,
      date: morning,
      title: `Aujourd’hui : ${title}`,
      body: `${tracking.label} · échéance à ${time(due)}.`,
      trackingId: tracking.id,
    });
  }
  reminders.push({
    id: `${tracking.id}-${index}-retard`,
    date: due,
    title: `En retard : ${title}`,
    body: `${tracking.label} · l’étape devait être terminée à ${time(due)}.`,
    trackingId: tracking.id,
  });
  return reminders.filter((reminder) => reminder.date.getTime() > now.getTime());
}

/** Tous les rappels à venir, pour les demandes en cours dont le process existe encore. */
export function allReminders(
  trackings: Tracking[],
  findProcess: (id: string) => Process | undefined,
  now: Date,
): Reminder[] {
  return trackings.flatMap((tracking) => {
    const process = findProcess(tracking.processId);
    return process && !tracking.finishedAt ? remindersFor(process, tracking, now) : [];
  });
}
