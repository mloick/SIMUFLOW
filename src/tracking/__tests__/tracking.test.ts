import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';

import { completeStep, currentStep, currentSteps, nextChoices, startTracking, timingOf, waitingSteps } from '../tracking';

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

describe('suivi d’une demande avec des tâches en parallèle', () => {
  const commande: Process = {
    id: 'c',
    name: 'Commande',
    steps: [
      { id: 'debut', kind: 'start', title: 'Commande validée' },
      { id: 'partage', kind: 'parallel', title: 'En parallèle' },
      { id: 'facture', kind: 'task', title: 'Préparer la facture', duration: 1 },
      { id: 'colis', kind: 'task', title: 'Préparer le colis', duration: 3 },
      { id: 'jonction', kind: 'parallel', title: 'Tout est prêt' },
      { id: 'expedier', kind: 'task', title: 'Expédier', duration: 1 },
      { id: 'fin', kind: 'end', title: 'Expédiée' },
    ],
    links: [
      { id: 'l1', from: 'debut', to: 'partage' },
      { id: 'l2', from: 'partage', to: 'facture' },
      { id: 'l3', from: 'partage', to: 'colis' },
      { id: 'l4', from: 'facture', to: 'jonction' },
      { id: 'l5', from: 'colis', to: 'jonction' },
      { id: 'l6', from: 'jonction', to: 'expedier' },
      { id: 'l7', from: 'expedier', to: 'fin' },
    ],
  };
  const index = (tracking: ReturnType<typeof startTracking>, stepId: string) =>
    tracking!.steps.findIndex((step) => step.stepId === stepId && !step.doneAt);

  it('commence toutes les branches en même temps, chacune avec son échéance', () => {
    const tracking = completeStep(commande, startTracking(commande, d(2, 9), 't', 'Commande 7')!, d(2, 10));
    expect(currentSteps(tracking).map((step) => [step.stepId, step.dueAt])).toEqual([
      ['facture', d(3, 10).toISOString()],
      ['colis', d(5, 10).toISOString()],
    ]);
    expect(tracking.finishedAt).toBeUndefined();
  });

  it('la jonction attend la dernière branche, dans n’importe quel ordre', () => {
    let tracking = completeStep(commande, startTracking(commande, d(2, 9), 't', 'Commande 7')!, d(2, 10));
    tracking = completeStep(commande, tracking, d(4, 10), undefined, index(tracking, 'colis'));
    expect(currentSteps(tracking).map((step) => step.stepId)).toEqual(['facture']);
    expect(waitingSteps(tracking).map((step) => step.stepId)).toEqual(['jonction']);

    tracking = completeStep(commande, tracking, d(4, 15), undefined, index(tracking, 'facture'));
    expect(waitingSteps(tracking)).toEqual([]);
    expect(currentSteps(tracking).map((step) => step.stepId)).toEqual(['expedier']);
    expect(currentStep(tracking)?.startedAt).toBe(d(4, 15).toISOString());

    tracking = completeStep(commande, tracking, d(5, 9));
    tracking = completeStep(commande, tracking, d(5, 10));
    expect(tracking.finishedAt).toBe(d(5, 10).toISOString());
  });

  it('ne fait rien sur une étape déjà terminée ou qui attend', () => {
    let tracking = completeStep(commande, startTracking(commande, d(2, 9), 't', 'Commande 7')!, d(2, 10));
    const colis = index(tracking, 'colis');
    tracking = completeStep(commande, tracking, d(3, 10), undefined, colis);
    expect(completeStep(commande, tracking, d(3, 11), undefined, colis)).toBe(tracking);
    const waiting = tracking.steps.findIndex((step) => step.waiting);
    expect(completeStep(commande, tracking, d(3, 11), undefined, waiting)).toBe(tracking);
  });
});
