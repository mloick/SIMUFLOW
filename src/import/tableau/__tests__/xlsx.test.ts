import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import { strToU8, zipSync } from 'fflate';

import { ImportError } from '../../errors';
import { classeurFictif } from '../__fixtures__/classeur';
import { cellPosition, excelDate, isDateFormat, rangeOf, readXlsx } from '../xlsx';

const exemple = lireExemple;

describe('readXlsx', () => {
  const workbook = readXlsx(classeurFictif());
  const [suivi, cachee] = workbook.sheets;

  it('lit les onglets dans l’ordre, sans l’onglet graphique, et repère les onglets masqués', () => {
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['Suivi', 'Cachée']);
    expect(suivi.hidden).toBeUndefined();
    expect(cachee.hidden).toBe(true);
  });

  it('donne les valeurs affichées : textes partagés, enrichis, en ligne, booléens, formules, dates', () => {
    expect(suivi.rows[0]).toEqual(['Famille', 'Situation', 'OLA 1', '']);
    expect(suivi.rows[1]).toEqual(['Famille X', 'VRAI', '3 jours ouvrés\n- Si pas de rep', '']);
    expect(suivi.rows[2]).toEqual(['', '05/11/2026', '3', '']);
    expect(suivi.rows[3]).toEqual(['', '05/11/2026 12:00', '', '0.3']);
  });

  it('retire les lignes vides de la fin et garde les cellules fusionnées', () => {
    expect(suivi.rows).toHaveLength(4);
    expect(suivi.merges).toEqual([{ top: 1, left: 0, bottom: 2, right: 0 }]);
  });

  it('lit un onglet écrit avec un préfixe d’espace de noms (x:c)', () => {
    expect(cachee.rows).toEqual([['Groupe A']]);
  });

  it('lit un vrai classeur enregistré par un tableur', () => {
    const exemples = readXlsx(exemple('workflow-sla-ola.xlsx'));
    expect(exemples.sheets.map((sheet) => sheet.name)).toEqual(['Dossier de financement', 'Contrat', 'Listes']);
    const [financement] = exemples.sheets;
    expect(financement.rows[1][0]).toBe('Famille X');
    expect(financement.rows[2][0]).toBe('');
    expect(financement.rows[1][8]).toContain('création auto de la task étape 2');
    expect(financement.merges).toEqual([{ top: 1, left: 0, bottom: 3, right: 0 }]);
  });

  it('refuse un ancien .xls ou un classeur protégé, avec un message qui dit quoi faire', () => {
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(() => readXlsx(cfb)).toThrow(/\.xls.*mot de passe.*\.xlsx/);
  });

  it('refuse un fichier qui n’est pas un classeur', () => {
    expect(() => readXlsx(strToU8('Bonjour'))).toThrow(ImportError);
    expect(() => readXlsx(zipSync({ 'word/document.xml': strToU8('<w/>') }))).toThrow(/pas un classeur/);
    expect(() => readXlsx(zipSync({ 'content.xml': strToU8('<o/>') }))).toThrow(/LibreOffice/);
  });
});

describe('outils', () => {
  it('convertit les références de cellules', () => {
    expect(cellPosition('A1')).toEqual({ row: 0, column: 0 });
    expect(cellPosition('$AB$12')).toEqual({ row: 11, column: 27 });
    expect(rangeOf('C3:A1')).toEqual({ top: 0, left: 0, bottom: 2, right: 2 });
  });

  it('reconnaît les formats de date', () => {
    expect(isDateFormat('dd/mm/yyyy')).toBe(true);
    expect(isDateFormat('[$-fr-FR]d mmmm yyyy')).toBe(true);
    expect(isDateFormat('0.00 "jours"')).toBe(false);
    expect(isDateFormat('General')).toBe(false);
  });

  it('convertit les numéros de série Excel en dates', () => {
    expect(excelDate(46331)).toBe('05/11/2026');
    expect(excelDate(44866, true)).toBe('02/11/2026');
  });
});
