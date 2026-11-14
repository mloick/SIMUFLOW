import { describe, expect, it } from '@jest/globals';

import { myPartSteps, reviewableSteps, reviewProblem, reviewProgress } from '../review';
import { demandeMateriel } from '../exemples';

const ids = (steps: { id: string }[]) => steps.map((step) => step.id);

describe('relecture par un membre', () => {
  it('ne donne à relire ni le départ ni la fin', () => {
    expect(ids(reviewableSteps(demandeMateriel))).toEqual(['validation', 'commande', 'livraison', 'refus']);
  });

  it('retrouve les étapes de l’acteur confié, sans tenir compte des majuscules ni des accents', () => {
    expect(ids(myPartSteps(demandeMateriel, 'responsable'))).toEqual(['validation', 'refus']);
    expect(ids(myPartSteps(demandeMateriel, ' ACHATS '))).toEqual(['commande']);
  });

  it('donne tout le process sans acteur confié', () => {
    expect(myPartSteps(demandeMateriel, null)).toHaveLength(4);
    expect(myPartSteps(demandeMateriel, 'Direction')).toHaveLength(0);
  });

  it('compte où en est la relecture', () => {
    const steps = myPartSteps(demandeMateriel, 'Responsable');
    expect(reviewProgress(steps, [])).toEqual({ total: 2, validated: 0, toRevise: 0, pending: 2, done: false });
    const progress = reviewProgress(steps, [
      { stepId: 'validation', status: 'valide', comment: null },
      { stepId: 'refus', status: 'a_revoir', comment: 'Plutôt 2 JO' },
      { stepId: 'commande', status: 'valide', comment: null }, // pas dans sa partie
    ]);
    expect(progress).toEqual({ total: 2, validated: 1, toRevise: 1, pending: 0, done: true });
  });

  it('demande un commentaire pour « à revoir »', () => {
    expect(reviewProblem('valide', '')).toBeNull();
    expect(reviewProblem('a_revoir', '  ')).toMatch(/à revoir/);
    expect(reviewProblem('a_revoir', 'Le délai est de 3 JO')).toBeNull();
    expect(reviewProblem('valide', 'x'.repeat(1001))).toMatch(/1000/);
  });
});
