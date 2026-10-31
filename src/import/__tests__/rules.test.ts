import { describe, expect, it } from '@jest/globals';

import type { Process } from '@/domain';

import { applyRules, describeRule, learnRules, mergeRules, parseRules, type ReadingRule } from '../rules';

const lu: Process = {
  id: 'p',
  name: 'Demande',
  source: 'drawio',
  steps: [
    { id: 'a', kind: 'start', title: 'Recevoir', shape: 'ellipse', actor: 'Serv. compta' },
    { id: 'b', kind: 'task', title: 'Montant élevé', shape: 'hexagon', actor: 'Serv. compta' },
    { id: 'c', kind: 'task', title: 'Payer', shape: 'rounded', actor: 'Trésorerie' },
    { id: 'd', kind: 'task', title: 'Archiver', shape: 'rounded', actor: 'Trésorerie' },
    { id: 'e', kind: 'end', title: 'Fin', shape: 'ellipse' },
  ],
  links: [],
};

const corrige = (changes: Record<string, Partial<Process['steps'][0]>>): Process => ({
  ...lu,
  steps: lu.steps.map((step) => ({ ...step, ...changes[step.id] })),
});

describe('apprendre des corrections', () => {
  it('retient un acteur renommé sur toutes ses étapes', () => {
    const rules = learnRules(lu, corrige({ a: { actor: 'Comptabilité' }, b: { actor: 'Comptabilité' } }));
    expect(rules).toEqual([{ type: 'actor', from: 'Serv. compta', to: 'Comptabilité' }]);
  });

  it('n’apprend rien d’un acteur changé sur une seule de ses étapes', () => {
    expect(learnRules(lu, corrige({ c: { actor: 'Comptabilité' } }))).toEqual([]);
  });

  it('retient le rôle d’une forme particulière, même vue une seule fois', () => {
    expect(learnRules(lu, corrige({ b: { kind: 'decision' } }))).toEqual([
      { type: 'role', shape: 'hexagon', role: 'decision' },
    ]);
  });

  it('demande plusieurs rectangles corrigés pareil avant d’en faire une règle', () => {
    expect(learnRules(lu, corrige({ c: { kind: 'decision' } }))).toEqual([]);
    expect(learnRules(lu, corrige({ c: { kind: 'decision' }, d: { kind: 'decision' } }))).toEqual([
      { type: 'role', shape: 'rounded', role: 'decision' },
    ]);
  });

  it('ignore les étapes supprimées et les process sans correction', () => {
    expect(learnRules(lu, lu)).toEqual([]);
    expect(learnRules(lu, { ...lu, steps: lu.steps.filter((step) => step.id !== 'b') })).toEqual([]);
  });
});

describe('appliquer les règles', () => {
  const rules: ReadingRule[] = [
    { type: 'actor', from: 'serv. compta', to: 'Comptabilité' },
    { type: 'role', shape: 'hexagon', role: 'decision' },
    { type: 'actor', from: 'Achats', to: 'Service achats' },
  ];

  it('corrige le process lu et dit quelles règles ont servi', () => {
    const { process, applied } = applyRules(lu, rules);
    expect(process.steps.map((step) => [step.actor, step.kind])).toEqual([
      ['Comptabilité', 'start'],
      ['Comptabilité', 'decision'],
      ['Trésorerie', 'task'],
      ['Trésorerie', 'task'],
      [undefined, 'end'],
    ]);
    expect(applied).toEqual([
      'Acteur « serv. compta » lu comme « Comptabilité »',
      'Forme hexagone lue comme une décision',
    ]);
  });

  it('rend le process tel quel quand aucune règle ne sert', () => {
    const result = applyRules(lu, [rules[2]]);
    expect(result.process).toBe(lu);
    expect(result.applied).toEqual([]);
  });

  it('remplace une règle sur le même acteur ou la même forme', () => {
    const merged = mergeRules(rules, [{ type: 'actor', from: 'Serv. Compta', to: 'Compta fournisseurs' }]);
    expect(merged.map(describeRule)).toEqual([
      'Forme hexagone lue comme une décision',
      'Acteur « Achats » lu comme « Service achats »',
      'Acteur « Serv. Compta » lu comme « Compta fournisseurs »',
    ]);
  });

  it('relit les règles enregistrées en écartant ce qui est mal formé', () => {
    expect(parseRules([...rules, { type: 'role', shape: 'x', role: 'autre' }, null, 'texte'])).toEqual(rules);
    expect(parseRules('abîmé')).toEqual([]);
  });
});
