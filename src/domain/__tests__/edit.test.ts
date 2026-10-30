import { describe, expect, it } from '@jest/globals';

import { actorsOf, makeDecision, renameLink, updateStep } from '../edit';
import type { Process } from '../types';

const process: Process = {
  id: 'p',
  name: 'Facture',
  steps: [
    { id: 'a', kind: 'start', title: 'Recevoir', actor: 'Comptabilité' },
    { id: 'b', kind: 'task', title: 'Vérifier', duration: 2 },
    { id: 'c', kind: 'end', title: 'Payer' },
    { id: 'd', kind: 'end', title: 'Refuser', actor: 'Direction' },
  ],
  links: [
    { id: 'l1', from: 'a', to: 'b' },
    { id: 'l2', from: 'b', to: 'c', label: 'ok' },
    { id: 'l3', from: 'b', to: 'd' },
  ],
};

describe('éditeur de process', () => {
  it('modifie une étape sans toucher au process d’origine', () => {
    const next = updateStep(process, 'b', { title: ' Contrôler ', actor: 'Achats', duration: 3, kind: 'decision' });
    expect(next.steps[1]).toEqual({ id: 'b', kind: 'decision', title: 'Contrôler', actor: 'Achats', duration: 3 });
    expect(process.steps[1]).toEqual({ id: 'b', kind: 'task', title: 'Vérifier', duration: 2 });
  });

  it('retire l’acteur ou le délai, et garde le titre s’il est vidé', () => {
    const next = updateStep(process, 'a', { title: '  ', actor: '', duration: null });
    expect(next.steps[0]).toEqual({ id: 'a', kind: 'start', title: 'Recevoir' });
  });

  it('renomme une branche, ou lui retire son nom', () => {
    expect(renameLink(process, 'l3', ' non ').links[2].label).toBe('non');
    expect(renameLink(process, 'l2', '').links[1]).toEqual({ id: 'l2', from: 'b', to: 'c' });
  });

  it('fait d’une étape une décision et nomme ses branches d’après leur arrivée', () => {
    const next = makeDecision(process, 'b');
    expect(next.steps[1].kind).toBe('decision');
    expect(next.links.map((link) => link.label)).toEqual([undefined, 'ok', 'Refuser']);
  });

  it('liste les acteurs une seule fois', () => {
    expect(actorsOf(updateStep(process, 'b', { actor: 'Comptabilité' }))).toEqual(['Comptabilité', 'Direction']);
  });
});
