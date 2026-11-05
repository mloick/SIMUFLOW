import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import { describeSheet, describeWorkbook, readTableFile } from '..';

const exemple = (name: string) => readTableFile(name, lireExemple(name));

describe('describeWorkbook', () => {
  it('reconnaît un workflow à SLA et OLA, ses situations et son onglet de liste', () => {
    const report = describeWorkbook(exemple('workflow-sla-ola.xlsx'));
    expect(report.kind).toBe('workflow');
    expect(report.sheets.map(({ name, kind, rowCount }) => [name, kind, rowCount])).toEqual([
      ['Dossier de financement', 'sla-ola', 4],
      ['Contrat', 'sla-ola', 2],
      ['Listes', 'liste', 6],
    ]);
    expect(report.sheets[0].mergedCount).toBe(1);
    expect(report.sheets[0].headerRow).toBe(1);
  });

  it('reconnaît un template de formulaire à ses onglets numérotés', () => {
    const report = describeWorkbook(exemple('template-formulaire.xlsx'));
    expect(report.kind).toBe('formulaire');
    expect(report.sheets.filter((sheet) => sheet.kind === 'formulaire').map((sheet) => sheet.name)).toEqual([
      '1. Basic info',
      '2. Catalog location',
      '3. Questions',
      '4. Access',
      '5. Fulfillment flow',
      '6. Assignment & Summary',
      '7. Values',
    ]);
  });

  it('reconnaît un tableau de process, même sous un titre', () => {
    const xlsx = describeWorkbook(exemple('demande-materiel.xlsx'));
    expect(xlsx.kind).toBe('process');
    expect(xlsx.sheets[0]).toMatchObject({ kind: 'process', rowCount: 5, headerRow: 3 });
    expect(describeWorkbook(exemple('demande-materiel.csv')).sheets[0]).toMatchObject({ kind: 'process', rowCount: 5 });
  });

  it('dit quand un tableau n’est pas reconnu, ou vide', () => {
    const sheet = (rows: string[][]) => ({ name: 'Feuil1', rows, merges: [] });
    expect(describeSheet(sheet([['Nom', 'Prénom', 'Ville'], ['a', 'b', 'c']])).kind).toBe('inconnu');
    expect(describeSheet(sheet([])).kind).toBe('vide');
    expect(describeWorkbook({ sheets: [sheet([['x', 'y', 'z']])], warnings: [] }).kind).toBe('inconnu');
  });
});

describe('readTableFile', () => {
  it('refuse un fichier Numbers ou d’un autre format', () => {
    expect(() => readTableFile('budget.numbers', new Uint8Array())).toThrow(/Numbers/);
    expect(() => readTableFile('image.png', new Uint8Array([0x89, 0x50]))).toThrow(/Format non reconnu/);
  });
});
