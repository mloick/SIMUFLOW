import { describe, expect, it } from '@jest/globals';

import { timingBadge } from '../format';

const d = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString(); // novembre 2026
const step = { stepId: 's', startedAt: d(2, 9), dueAt: d(4, 14) };

describe('textes du suivi', () => {
  it('donne l’état d’une étape en cours', () => {
    expect(timingBadge(step, new Date(d(3, 9)))).toEqual({ label: 'À l’heure', tone: 'success' });
    expect(timingBadge(step, new Date(d(4, 12)))).toEqual({ label: 'Échéance proche', tone: 'warning' });
    expect(timingBadge(step, new Date(d(5, 14)))).toEqual({ label: 'En retard de 1 jour ouvré', tone: 'danger' });
  });

  it('donne l’état d’une étape terminée', () => {
    expect(timingBadge({ ...step, doneAt: d(4, 10) }, new Date(d(9, 9))).label).toBe('Terminée à temps');
    expect(timingBadge({ ...step, doneAt: d(6, 14) }, new Date(d(9, 9))).label).toBe(
      'Terminée avec 2 jours ouvrés de retard',
    );
    expect(timingBadge({ stepId: 's', startedAt: d(2, 9) }, new Date(d(9, 9))).label).toBe('Sans délai');
  });
});
