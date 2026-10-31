import { describe, expect, it } from '@jest/globals';

import type { TextLine } from '../../../modules/text-recognition';
import { countPaths, diagnose } from '@/domain';

import tableaux from '../__fixtures__/tableaux.json';
import { groupRows } from '../rows';
import { findTable } from '../table';
import { delayOf, nextOf, tableToProcess } from '../to-process';

/** Photo d'un tableau d'exemple → process, comme dans l'écran Scanner. */
const scan = (id: string) => {
  const found = tableaux.find((item) => item.id === id);
  const table = found && findTable(groupRows(found.lines as TextLine[]));
  if (!table) throw new Error(`Tableau ${id} non trouvé`);
  const result = tableToProcess(table, table.title ?? 'Tableau', id);
  return { table, process: result.processes[0], warnings: result.warnings };
};

const total = (id: string) => scan(id).process.steps.reduce((sum, step) => sum + (step.duration ?? 0), 0);
const kinds = (id: string) => scan(id).process.steps.map((step) => step.kind);

describe('délais écrits dans un tableau', () => {
  it('convertit jours, heures, semaines et nombre seul en jours ouvrés', () => {
    expect(delayOf('0,5 JO')).toBe(0.5);
    expect(delayOf('3 jours')).toBe(3);
    expect(delayOf('4 h')).toBe(0.5);
    expect(delayOf('1 sem.')).toBe(5);
    expect(delayOf('2 semaines')).toBe(10);
    expect(delayOf('2')).toBe(2);
    expect(delayOf('—')).toBeUndefined();
    expect(delayOf('bientôt')).toBeUndefined();
  });
});

describe('colonne Suite', () => {
  it('lit un numéro, plusieurs cas, ou la fin', () => {
    expect(nextOf('2')).toEqual([{ to: '2' }]);
    expect(nextOf('oui → 3 ; non → 4')).toEqual([
      { to: '3', label: 'oui' },
      { to: '4', label: 'non' },
    ]);
    expect(nextOf('oui -> 3 non -> 4')).toEqual([
      { to: '3', label: 'oui' },
      { to: '4', label: 'non' },
    ]);
    expect(nextOf('3, 4')).toEqual([{ to: '3' }, { to: '4' }]);
    expect(nextOf('fin')).toBe('end');
    expect(nextOf('')).toEqual([]);
    expect(nextOf('voir plus haut')).toBeNull();
  });
});

describe('tableaux d’exemple → process', () => {
  it('1. quatre étapes à la suite, 6,5 JO, nommé d’après le titre du tableau', () => {
    const { process, warnings } = scan('t1');
    expect(process.name).toBe('Demande de matériel');
    expect(process.source).toBe('scan');
    expect(kinds('t1')).toEqual(['start', 'task', 'task', 'end']);
    expect(process.steps.map((step) => step.actor)).toEqual(['Accueil', 'Manager', 'Achats', 'Logistique']);
    expect(total('t1')).toBe(6.5);
    expect(diagnose(process)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('2. autres titres de colonnes : 4,5 JO', () => {
    expect(scan('t2').process.steps[0]).toMatchObject({ title: 'Préparer le contrat', actor: 'Ressources humaines' });
    expect(total('t2')).toBe(4.5);
  });

  it('3. une décision « oui / non », deux chemins', () => {
    const { process } = scan('t3');
    expect(kinds('t3')).toEqual(['start', 'decision', 'task', 'task', 'end']);
    expect(process.links.filter((link) => link.label).map((link) => link.label)).toEqual(['oui', 'non']);
    expect(countPaths(process).count).toBe(2);
  });

  it('4. délais variés : 0,5, 3, 5, 2 JO et rien pour la dernière étape', () => {
    expect(scan('t4').process.steps.map((step) => step.duration)).toEqual([0.5, 3, 5, 2, undefined]);
  });

  it('5. une boucle, un acteur manquant signalé, un titre sur deux lignes', () => {
    const { process, warnings } = scan('t5');
    expect(kinds('t5')).toEqual(['start', 'task', 'decision', 'end']);
    expect(process.links).toContainEqual(expect.objectContaining({ label: 'non', to: 't5-s1' }));
    expect(process.steps[1].actor).toBeUndefined();
    expect(warnings).toEqual(['Étape 2 : pas d’acteur, à compléter dans l’éditeur.']);
    expect(process.steps[3].title).toBe("Mettre en page et publier sur l'intranet");
  });

  it('6. deux décisions, deux fins, trois chemins', () => {
    const { process } = scan('t6');
    expect(kinds('t6').filter((kind) => kind === 'decision')).toHaveLength(2);
    expect(kinds('t6').filter((kind) => kind === 'end')).toHaveLength(2);
    expect(countPaths(process).count).toBe(3);
  });

  it('signale une suite qui n’existe pas', () => {
    const table = {
      columns: [
        { kind: 'step' as const, label: 'Étape' },
        { kind: 'next' as const, label: 'Suite' },
      ],
      rows: [
        ['Ouvrir', '9'],
        ['Fermer', 'fin'],
      ],
      ignored: 0,
    };
    expect(tableToProcess(table, 'Essai', 'x').warnings).toEqual([
      'Étape 1 : la suite 9 n’existe pas dans le tableau.',
    ]);
  });
});
