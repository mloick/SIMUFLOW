import { describe, expect, it } from '@jest/globals';

import { demandeMateriel } from '../exemples';
import { mergeProcess, sameProcess, sameValue } from '../merge';
import type { Process } from '../types';

const base: Process = demandeMateriel;
const rename = (process: Process, stepId: string, title: string): Process => ({
  ...process,
  steps: process.steps.map((step) => (step.id === stepId ? { ...step, title } : step)),
});
const titles = (process: Process) => process.steps.map((step) => step.title);

describe('fusion à trois versions', () => {
  it('garde les deux modifications quand elles touchent des étapes différentes', () => {
    // Dans le train : je renomme la validation. Au bureau, sur le web : on ajoute une étape d'archivage.
    const mine = rename(base, 'validation', 'Valider la demande');
    const theirs: Process = {
      ...base,
      steps: [...base.steps, { id: 'archive', kind: 'task', title: 'Archiver', actor: 'Logistique' }],
      links: [...base.links.filter((link) => link.id !== 'l5'), { id: 'l7', from: 'livraison', to: 'archive' }, { id: 'l8', from: 'archive', to: 'fin' }],
    };
    const { process, conflicts } = mergeProcess(base, mine, theirs);
    expect(conflicts).toEqual([]);
    expect(titles(process)).toContain('Valider la demande');
    expect(titles(process)).toContain('Archiver');
    expect(process.links.map((link) => link.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l6', 'l7', 'l8']);
  });

  it('prend une suppression faite d’un seul côté', () => {
    const mine: Process = {
      ...base,
      steps: base.steps.filter((step) => step.id !== 'refus'),
      links: base.links.filter((link) => link.id !== 'l3' && link.id !== 'l6'),
    };
    const theirs = { ...base, name: 'Demande de matériel de bureau' };
    const { process, conflicts } = mergeProcess(base, mine, theirs);
    expect(conflicts).toEqual([]);
    expect(process.name).toBe('Demande de matériel de bureau');
    expect(process.steps.some((step) => step.id === 'refus')).toBe(false);
  });

  it('ajoute à la fin les étapes ajoutées seulement sur le téléphone, et garde mon identifiant', () => {
    const mine: Process = { ...base, id: 'import-1', steps: [...base.steps, { id: 'note', kind: 'task', title: 'Noter' }] };
    const theirs: Process = { ...base, id: 'cloud-1', sla: 10 };
    const { process, conflicts } = mergeProcess(base, mine, theirs);
    expect(conflicts).toEqual([]);
    expect(process.id).toBe('import-1');
    expect(process.sla).toBe(10);
    expect(process.steps.at(-1)?.id).toBe('note');
  });

  it('signale un conflit quand la même étape change différemment des deux côtés', () => {
    const mine = rename(base, 'commande', 'Commander');
    const theirs = rename(base, 'commande', 'Passer la commande en ligne');
    const { process, conflicts } = mergeProcess(base, mine, theirs);
    expect(conflicts).toEqual(['step:commande']);
    // En cas de conflit, la version du serveur est gardée pour cet élément.
    expect(titles(process)).toContain('Passer la commande en ligne');
  });

  it('signale un conflit quand une étape est modifiée d’un côté et supprimée de l’autre', () => {
    const mine = rename(base, 'refus', 'Prévenir par e-mail');
    const theirs: Process = { ...base, steps: base.steps.filter((step) => step.id !== 'refus') };
    expect(mergeProcess(base, mine, theirs).conflicts).toEqual(['step:refus']);
  });

  it('accepte la même modification faite des deux côtés', () => {
    const both = rename(base, 'livraison', 'Livrer');
    expect(mergeProcess(base, both, rename(base, 'livraison', 'Livrer')).conflicts).toEqual([]);
  });

  it('signale un conflit sur le nom ou le projet', () => {
    expect(mergeProcess(base, { ...base, name: 'A' }, { ...base, name: 'B' }).conflicts).toEqual(['name']);
    const inProject = { ...base, projectId: 'p1' };
    expect(mergeProcess(inProject, { ...inProject, projectId: null }, { ...inProject, projectId: 'p2' }).conflicts).toEqual([
      'projectId',
    ]);
  });

  it('garde la sortie d’un projet faite sur le téléphone, pour l’envoyer au serveur', () => {
    const inProject = { ...base, projectId: 'p1' };
    const { process } = mergeProcess(inProject, { ...inProject, projectId: null }, { ...inProject, sla: 5 });
    expect(process.projectId).toBeNull();
    expect(process.sla).toBe(5);
  });

  it('garde la date de correction la plus récente', () => {
    const mine = { ...base, editedAt: '2026-11-17T07:00:00Z' };
    const theirs = { ...base, editedAt: '2026-11-17T08:30:00Z' };
    expect(mergeProcess(base, mine, theirs).process.editedAt).toBe('2026-11-17T08:30:00Z');
  });
});

describe('comparaison', () => {
  it('ne tient pas compte de l’ordre des clés ni des valeurs absentes', () => {
    expect(sameValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });

  it('compare le contenu d’un process, pas son identifiant ni sa date de correction', () => {
    expect(sameProcess(base, { ...base, id: 'autre', editedAt: '2026-11-17T08:00:00Z', name: ' Demande de matériel ' })).toBe(
      true,
    );
    expect(sameProcess(base, { ...base, projectId: null })).toBe(true);
    expect(sameProcess(base, rename(base, 'refus', 'Refuser'))).toBe(false);
  });
});
