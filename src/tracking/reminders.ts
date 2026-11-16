/**
 * Rappels d'échéance d'une demande suivie : pour l'étape en cours, s'il y a une
 * échéance,
 *
 * - le jour de l'échéance à 9 h : « Aujourd'hui : Commander, échéance à 14:00 » ;
 * - à l'échéance : « En retard : Commander devait être terminée à 14:00 ».
 *
 * Si le process a un SLA (mode Délais), deux rappels pour toute la demande :
 *
 * - quand les trois quarts du SLA sont consommés : « SLA bientôt dépassé » ;
 * - à l'échéance du SLA : « SLA dépassé ».
 *
 * Un rappel déjà passé n'est pas programmé. Quand l'étape est terminée, ses
 * rappels disparaissent (on reprogramme tout à chaque changement). Fonctions
 * pures, testées dans __tests__/reminders.test.ts.
 */

import type { Process } from '@/domain';
import { getT } from '@/i18n';

import { WORKDAY_START_HOUR } from './calendar';
import { warningMoment } from './delays';
import { currentStep, currentSteps, stepOf, type Tracking } from './tracking';

export type Reminder = {
  /** Identifiant stable : le même rappel reprogrammé remplace l'ancien. */
  id: string;
  date: Date;
  title: string;
  body: string;
  trackingId: string;
};

/** Les rappels à venir d'une demande suivie. */
export function remindersFor(process: Process, tracking: Tracking, now: Date): Reminder[] {
  const t = getT();
  const text = t.tracking.reminders;
  const time = t.dates.time;
  const current = currentStep(tracking);
  const reminders: Reminder[] = [];
  if (current && tracking.slaDueAt && tracking.sla !== undefined) {
    const slaDue = new Date(tracking.slaDueAt);
    reminders.push(
      {
        id: `${tracking.id}-sla-bientot`,
        date: warningMoment(tracking.startedAt, tracking.sla),
        title: text.slaSoonTitle(tracking.label),
        body: text.slaSoonBody(t.dates.moment(slaDue)),
        trackingId: tracking.id,
      },
      {
        id: `${tracking.id}-sla-depasse`,
        date: slaDue,
        title: text.slaLateTitle(tracking.label),
        body: text.slaLateBody(t.dates.moment(slaDue)),
        trackingId: tracking.id,
      },
    );
  }
  // Une étape en cours (plusieurs avec des tâches en parallèle) : rappel le matin de l'échéance, puis à l'échéance.
  for (const step of currentSteps(tracking)) {
    if (!step.dueAt) continue;
    const due = new Date(step.dueAt);
    const title = stepOf(process, step)?.title || text.untitled;
    const index = tracking.steps.indexOf(step);
    const morning = new Date(due.getFullYear(), due.getMonth(), due.getDate(), WORKDAY_START_HOUR);
    if (morning < due) {
      reminders.push({
        id: `${tracking.id}-${index}-jour`,
        date: morning,
        title: text.todayTitle(title),
        body: text.todayBody(tracking.label, time(due)),
        trackingId: tracking.id,
      });
    }
    reminders.push({
      id: `${tracking.id}-${index}-retard`,
      date: due,
      title: text.lateTitle(title),
      body: text.lateBody(tracking.label, time(due)),
      trackingId: tracking.id,
    });
  }
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
