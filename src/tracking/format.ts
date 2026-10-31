/**
 * Textes du suivi : dates d'échéance et état d'une étape (« En retard de
 * 1,5 jour ouvré »). Testés dans __tests__/format.test.ts.
 */

import type { BadgeTone } from '@/components/badge';
import { plural } from '@/utils/format';

import { workingDaysBetween } from './calendar';
import { timingOf, type TrackedStep } from './tracking';

/** « lundi 2 novembre à 13:00 ». */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
}

const days = (value: number) => plural(value, 'jour ouvré', 'jours ouvrés');

/** L'état d'une étape et sa couleur de pastille. */
export function timingBadge(step: TrackedStep, now: Date): { label: string; tone: BadgeTone } {
  const timing = timingOf(step, now);
  if (timing === 'none') return { label: step.doneAt ? 'Terminée' : 'Sans délai', tone: 'neutral' };
  if (timing === 'late') {
    const end = step.doneAt ? new Date(step.doneAt) : now;
    const late = Math.max(0.1, workingDaysBetween(new Date(step.dueAt!), end));
    return {
      label: `${step.doneAt ? 'Terminée avec' : 'En retard de'} ${days(late)}${step.doneAt ? ' de retard' : ''}`,
      tone: 'danger',
    };
  }
  if (step.doneAt) return { label: 'Terminée à temps', tone: 'success' };
  if (timing === 'soon') return { label: 'Échéance proche', tone: 'warning' };
  return { label: 'À l’heure', tone: 'success' };
}
