import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import { readTableFile, sheetToProcess, sheetToTable, workbookToProcesses } from '..';
import { filledRows } from '../grid';
import type { Sheet } from '../types';

const exemple = (name: string) => readTableFile(name, lireExemple(name));

describe('tableau de process (Excel, CSV)', () => {
  it('lit un classeur : titre au-dessus du tableau, étapes, acteurs, délais, décision', () => {
    const { processes, warnings } = workbookToProcesses(exemple('demande-materiel.xlsx'), 'x');
    expect(warnings).toEqual([]);
    expect(processes).toHaveLength(1);
    const [process] = processes;
    expect(process.name).toBe('Demande de matériel informatique');
    expect(process.source).toBe('tableau');
    expect(process.steps.map((step) => [step.title, step.kind, step.actor, step.duration])).toEqual([
      ['Saisir la demande', 'start', 'Demandeur', 1],
      ['Valider la demande', 'decision', 'Manager', 2],
      ['Commander le matériel', 'task', 'Service Achats', 5],
      ['Livrer le matériel', 'end', 'Service Informatique', 3],
      ['Informer le demandeur', 'end', 'Manager', 1],
    ]);
    expect(process.links.filter((link) => link.label).map((link) => link.label)).toEqual(['oui', 'non']);
  });

  it('lit le même tableau en CSV, nommé d’après le fichier', () => {
    const [process] = workbookToProcesses(exemple('demande-materiel.csv'), 'x').processes;
    expect(process.name).toBe('demande-materiel');
    expect(process.steps).toHaveLength(5);
  });

  it('ne crée rien pour un workflow SLA / OLA ou un formulaire (lus plus tard)', () => {
    expect(workbookToProcesses(exemple('workflow-sla-ola.xlsx'), 'x').processes).toEqual([]);
    expect(workbookToProcesses(exemple('template-formulaire.xlsx'), 'x').processes).toEqual([]);
  });

  it('applique un acteur fusionné à chaque ligne et s’arrête à la première ligne vide', () => {
    const sheet: Sheet = {
      name: 'Feuil1',
      rows: [
        ['Étape', 'Responsable', 'Durée', 'Remarque'],
        ['Préparer', 'Équipe A', '1 j', 'x'],
        ['Vérifier', '', '2 j', ''],
        ['', '', '', ''],
        ['Note sous le tableau', '', '', ''],
      ],
      merges: [{ top: 1, left: 1, bottom: 2, right: 1 }],
    };
    const table = sheetToTable(sheet);
    expect(table?.columns.map((column) => column.kind)).toEqual(['step', 'actor', 'delay']);
    expect(table?.rows).toEqual([
      ['Préparer', 'Équipe A', '1 j'],
      ['Vérifier', 'Équipe A', '2 j'],
    ]);
    const process = sheetToProcess(sheet, 'y')!.processes[0];
    expect(process.name).toBe('Feuil1');
    expect(process.steps.map((step) => step.actor)).toEqual(['Équipe A', 'Équipe A']);
  });

  it('donne un process par onglet, et préfixe les remarques par le nom de l’onglet', () => {
    const onglet = (name: string, delay: string): Sheet => ({
      name,
      rows: [
        ['Étape', 'Acteur', 'Délai'],
        ['Faire', 'Équipe', delay],
      ],
      merges: [],
    });
    const { processes, warnings } = workbookToProcesses(
      { sheets: [onglet('Un', '1 JO'), onglet('Deux', 'bientôt')], warnings: [] },
      'z',
    );
    expect(processes.map((process) => process.name)).toEqual(['Un', 'Deux']);
    expect(new Set(processes.flatMap((process) => process.steps.map((step) => step.id))).size).toBe(2);
    expect(warnings).toEqual(['Deux : Ligne 1 : délai « bientôt » non compris.']);
  });
});

describe('filledRows', () => {
  it('recopie le texte d’une zone fusionnée dans toutes ses cases vides', () => {
    expect(
      filledRows({
        name: 'f',
        rows: [
          ['a', ''],
          ['', ''],
        ],
        merges: [{ top: 0, left: 0, bottom: 1, right: 1 }],
      }),
    ).toEqual([
      ['a', 'a'],
      ['a', 'a'],
    ]);
  });
});
