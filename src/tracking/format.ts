/**
 * Textes du suivi, dans la langue de l'app : dates d'échéance et état d'une
 * étape (« En retard de 1,5 jour ouvré »). Testés dans __tests__/format.test.ts.
 */

import type { BadgeTone } from '@/components/badge';
import { getT, type Messages } from '@/i18n';

import { workingDaysBetween } from './calendar';
import { timingOf, type TrackedStep } from './tracking';

/** « lundi 2 novembre à 13:00 », dans la langue de l'app. */
export function formatMoment(iso: string, t: Messages = getT()): string {
  return t.dates.moment(new Date(iso));
}

/** L'état d'une étape et sa couleur de pastille. */
export function timingBadge(step: TrackedStep, now: Date, t: Messages = getT()): { label: string; tone: BadgeTone } {
  const badge = t.tracking.badge;
  const days = (value: number) => t.format.count(value, t.words.workingDay);
  const timing = timingOf(step, now);
  if (timing === 'none') return { label: step.doneAt ? badge.done : badge.noDelay, tone: 'neutral' };
  if (timing === 'late') {
    const end = step.doneAt ? new Date(step.doneAt) : now;
    const late = days(Math.max(0.1, workingDaysBetween(new Date(step.dueAt!), end)));
    return { label: step.doneAt ? badge.doneLate(late) : badge.late(late), tone: 'danger' };
  }
  if (step.doneAt) return { label: badge.doneOnTime, tone: 'success' };
  if (timing === 'soon') return { label: badge.soon, tone: 'warning' };
  return { label: badge.onTime, tone: 'success' };
}
