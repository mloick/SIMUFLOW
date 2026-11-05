import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import { strToU8 } from 'fflate';

import { decodeText, guessSeparator, parseCsv, readCsv } from '../csv';

describe('CSV', () => {
  it('devine le séparateur', () => {
    expect(guessSeparator('N°;Étape;Acteur')).toBe(';');
    expect(guessSeparator('a,b,"c;d"')).toBe(',');
    expect(guessSeparator('a\tb\tc')).toBe('\t');
  });

  it('gère les guillemets, les séparateurs et retours à la ligne dans une case', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n1;"deux\nlignes";3')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', 'deux\nlignes', '3'],
    ]);
  });

  it('lit l’UTF-8 avec BOM et le Windows-1252 d’un Excel français', () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('Étape')]))).toBe('Étape');
    expect(decodeText(new Uint8Array([0xc9, 0x74, 0x61, 0x70, 0x65]))).toBe('Étape');
  });

  it('donne un onglet nommé d’après le fichier', () => {
    const bytes = lireExemple('demande-materiel.csv');
    const workbook = readCsv(bytes, 'demande-materiel.csv');
    expect(workbook.sheets).toHaveLength(1);
    expect(workbook.sheets[0].name).toBe('demande-materiel');
    expect(workbook.sheets[0].rows[0]).toEqual(['N°', 'Étape', 'Acteur', 'Délai', 'Suite']);
    expect(workbook.sheets[0].rows).toHaveLength(6);
  });

  it('refuse un CSV vide', () => {
    expect(() => readCsv(new Uint8Array(), 'vide.csv')).toThrow(/vide/);
  });
});
