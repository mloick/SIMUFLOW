import { describe, expect, it } from '@jest/globals';

import {
  actorsOf,
  addBranch,
  addStepAfter,
  makeDecision,
  removeLink,
  removeStep,
  renameLink,
  updateStep,
} from '../edit';
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

describe('ajouter et retirer', () => {
  it('insère une étape entre une étape et son unique suite', () => {
    const { process: next, stepId } = addStepAfter(process, 'a', 'Enregistrer');
    expect(next.steps.map((step) => step.id)).toEqual(['a', stepId, 'b', 'c', 'd']);
    expect(next.links.find((link) => link.id === 'l1')).toMatchObject({ from: 'a', to: stepId });
    expect(next.links.find((link) => link.from === stepId)).toMatchObject({ to: 'b' });
  });

  it('ajoute une suite de plus après une étape qui en a déjà plusieurs', () => {
    const { process: next, stepId } = addStepAfter(process, 'b', '');
    expect(next.steps.find((step) => step.id === stepId)).toMatchObject({ kind: 'task', title: 'Nouvelle étape' });
    expect(next.links.filter((link) => link.from === 'b')).toHaveLength(3);
  });

  it('ajoute un cas vers une nouvelle étape, ou vers une étape existante', () => {
    const versNouvelle = addBranch(process, 'b', 'à compléter');
    const cas = versNouvelle.links.at(-1);
    expect(cas).toMatchObject({ from: 'b', label: 'à compléter' });
    expect(versNouvelle.steps.find((step) => step.id === cas?.to)?.title).toBe('à compléter');
    const versExistante = addBranch(process, 'b', 'retour', 'a');
    expect(versExistante.steps).toHaveLength(4);
    expect(versExistante.links.at(-1)).toMatchObject({ from: 'b', to: 'a', label: 'retour' });
  });

  it('supprime une étape de passage en reliant l’avant et l’après', () => {
    const chain: Process = {
      ...process,
      links: [
        { id: 'l1', from: 'a', to: 'b', label: 'go' },
        { id: 'l2', from: 'b', to: 'c' },
      ],
    };
    const next = removeStep(chain, 'b');
    expect(next.steps.map((step) => step.id)).toEqual(['a', 'c', 'd']);
    expect(next.links).toEqual([{ id: 'l1', from: 'a', to: 'c', label: 'go' }]);
  });

  it('supprime une décision et toutes ses branches', () => {
    const next = removeStep(process, 'b');
    expect(next.links).toEqual([]);
    expect(removeLink(process, 'l3').links.map((link) => link.id)).toEqual(['l1', 'l2']);
  });
});
