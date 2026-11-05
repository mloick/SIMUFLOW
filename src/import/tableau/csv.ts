/**
 * Lecture d'un fichier CSV : un seul onglet, nommé d'après le fichier.
 *
 * - Séparateur deviné sur la première ligne : point-virgule (Excel en
 *   français), virgule ou tabulation.
 * - Guillemets : une case entre guillemets peut contenir le séparateur, des
 *   retours à la ligne et des guillemets doublés (« "" »).
 * - Encodage : UTF-8, sinon Windows-1252 (le CSV d'un Excel français).
 *
 * Fonctions pures, testées dans __tests__/csv.test.ts.
 */

import { strFromU8 } from 'fflate';

import { ImportError } from '../errors';

import type { Workbook } from './types';
import { MAX_COLUMNS, MAX_ROWS, squareGrid } from './xlsx';

const SEPARATORS = [';', ',', '\t'];

/** Texte du fichier : UTF-8 s'il est valide, sinon Latin-1 (proche de Windows-1252). */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = strFromU8(bytes);
  } catch {
    text = strFromU8(bytes, true);
  }
  if (text.includes('�')) text = strFromU8(bytes, true);
  return text.replace(/^﻿/, '');
}

/** Le séparateur le plus présent sur la première ligne, hors guillemets. */
export function guessSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');
  let best = ';';
  let bestCount = 0;
  for (const separator of SEPARATORS) {
    const count = firstLine.split(separator).length - 1;
    if (count > bestCount) {
      best = separator;
      bestCount = count;
    }
  }
  return best;
}

/** Découpe un texte CSV en lignes et en cases. */
export function parseCsv(text: string, separator = guessSeparator(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((value) => value.replace(/\r\n?/g, '\n').trim()));
}

/** Lit un CSV ; l'onglet prend le nom du fichier, sans l'extension. */
export function readCsv(bytes: Uint8Array, fileName: string): Workbook {
  const rows = parseCsv(decodeText(bytes));
  const warnings: string[] = [];
  const name = fileName.replace(/\.[^.]+$/, '') || 'Tableau';
  if (rows.length > MAX_ROWS || rows.some((cells) => cells.length > MAX_COLUMNS)) {
    warnings.push(`Seules les ${MAX_ROWS} premières lignes et ${MAX_COLUMNS} premières colonnes sont lues.`);
  }
  const grid = squareGrid(rows.slice(0, MAX_ROWS).map((cells) => cells.slice(0, MAX_COLUMNS)));
  if (grid.length === 0) throw new ImportError('Ce fichier CSV est vide.');
  return { sheets: [{ name, rows: grid, merges: [] }], warnings };
}
