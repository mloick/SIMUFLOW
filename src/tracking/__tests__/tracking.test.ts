import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';

import { completeStep, currentStep, nextChoices, startTracking, timingOf } from '../tracking';

/** Validation d'une facture (tableau 3 des exemples) : une décision « oui / non ». */
const facture: Process = {
  id: 'p',
  name: 'Validation d’une facture',
  steps: [
    { id: '1', kind: 'start', title: 'Recevoir la facture', duration: 0.5 },
    { id: '2', kind: 'decision', title: 'Montant supérieur à 500 € ?' },
    { id: '3', kind: 'task', title: 'Faire viser', duration: 2 },
    { id: '4', kind: 'task', title: 'Payer', duration: 1 },
    { id: '5', kind: 'end', title: 'Archiver' },
  ],
  links: [
    { id: 'a', from: '1', to: '2' },
    { id: 'b', from: '2', to: '3', label: 'oui' },
    { id: 'c', from: '2', to: '4', label: 'non' },
    { id: 'd', from: '3', to: '4' },
    { id: 'e', from: '4', to: '5' },
  ],
};

const d = (day: number, hour: number) => new Date(2026, 10, day, hour); // novembre 2026

describe('suivi d’une demande réelle', () => {
  it('commence au départ, avec son échéance en jours ouvrés', () => {
    const tracking = startTracking(facture, d(2, 9), 't', 'Facture 42')!;
    expect(currentStep(tracking)).toMatchObject({ stepId: '1', dueAt: d(2, 13).toISOString() });
  });

  it('avance seul quand il n’y a qu’une suite, et attend la branche à une décision', () => {
    let tracking = startTracking(facture, d(2, 9), 't', 'Facture 42')!;
    tracking = completeStep(facture, tracking, d(2, 12));
    expect(currentStep(tracking)?.stepId).toBe('2');
    expect(currentStep(tracking)?.dueAt).toBeUndefined();
    expect(nextChoices(facture, tracking).map((link) => link.label)).toEqual(['oui', 'non']);
    expect(completeStep(facture, tracking, d(2, 14))).toBe(tracking); // sans branche, rien ne bouge
    tracking = completeStep(facture, tracking, d(2, 14), 'b');
    expect(currentStep(tracking)).toMatchObject({ stepId: '3', linkId: 'b', dueAt: d(4, 14).toISOString() });
  });

  it('se termine à la fin du process', () => {
    let tracking = startTracking(facture, d(2, 9), 't', 'Facture 42')!;
    tracking = completeStep(facture, tracking, d(2, 10));
    tracking = completeStep(facture, tracking, d(2, 11), 'c');
    tracking = completeStep(facture, tracking, d(3, 9));
    expect(currentStep(tracking)?.stepId).toBe('5');
    tracking = completeStep(facture, tracking, d(3, 10));
    expect(tracking.finishedAt).toBe(d(3, 10).toISOString());
    expect(currentStep(tracking)).toBeUndefined();
    expect(tracking.steps.map((step) => step.stepId)).toEqual(['1', '2', '4', '5']);
  });

  it('dit si une étape est à l’heure, bientôt due ou en retard', () => {
    const step = { stepId: '3', startedAt: d(2, 9).toISOString(), dueAt: d(4, 14).toISOString() };
    expect(timingOf(step, d(3, 9))).toBe('on-time');
    expect(timingOf(step, d(4, 11))).toBe('soon');
    expect(timingOf(step, d(4, 15))).toBe('late');
    expect(timingOf({ ...step, doneAt: d(4, 10).toISOString() }, d(9, 9))).toBe('on-time');
    expect(timingOf({ stepId: '2', startedAt: d(2, 9).toISOString() }, d(9, 9))).toBe('none');
  });
});
