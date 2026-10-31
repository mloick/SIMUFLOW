import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';

import { allReminders, remindersFor } from '../reminders';
import { completeStep, startTracking } from '../tracking';

const process: Process = {
  id: 'p',
  name: 'Commande',
  steps: [
    { id: '1', kind: 'start', title: 'Demander un devis', duration: 1 },
    { id: '2', kind: 'task', title: 'Commander' },
    { id: '3', kind: 'end', title: 'Clore' },
  ],
  links: [
    { id: 'a', from: '1', to: '2' },
    { id: 'b', from: '2', to: '3' },
  ],
};

const d = (day: number, hour: number) => new Date(2026, 10, day, hour); // novembre 2026

describe('rappels d’échéance', () => {
  const tracking = startTracking(process, d(2, 14), 't', 'Demande 1')!; // échéance mardi 3 à 14 h

  it('prévient le matin du jour de l’échéance, puis à l’échéance', () => {
    const reminders = remindersFor(process, tracking, d(2, 15));
    expect(reminders.map((item) => [item.id, item.date])).toEqual([
      ['t-0-jour', d(3, 9)],
      ['t-0-retard', d(3, 14)],
    ]);
    expect(reminders[0].title).toBe('Aujourd’hui : Demander un devis');
    expect(reminders[1].title).toBe('En retard : Demander un devis');
  });

  it('ne programme pas un rappel déjà passé', () => {
    expect(remindersFor(process, tracking, d(3, 10)).map((item) => item.id)).toEqual(['t-0-retard']);
    expect(remindersFor(process, tracking, d(3, 15))).toEqual([]);
  });

  it('rien pour une étape sans délai ni pour une demande close', () => {
    const next = completeStep(process, tracking, d(2, 16));
    expect(remindersFor(process, next, d(2, 16))).toEqual([]);
    const closed = completeStep(process, completeStep(process, next, d(2, 17)), d(2, 17));
    expect(allReminders([closed], () => process, d(2, 17))).toEqual([]);
  });

  it('ignore une demande dont le process a été supprimé', () => {
    expect(allReminders([tracking], () => undefined, d(2, 15))).toEqual([]);
    expect(allReminders([tracking], () => process, d(2, 15))).toHaveLength(2);
  });
});
