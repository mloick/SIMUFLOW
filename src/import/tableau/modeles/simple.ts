/**
 * Modèle « process classique » : un onglet avec une ligne d'en-tête du
 * scanner (N°, Étape, Acteur, Délai, Suite et leurs synonymes), une ligne par
 * étape. La transformation en process est celle du scanner
 * (`src/scan/to-process.ts`) : mêmes suites, mêmes délais, mêmes rôles.
 *
 * - L'en-tête peut être précédé d'un titre : il donne le nom du process.
 * - Les cellules fusionnées (un acteur sur plusieurs lignes) valent pour
 *   chaque ligne.
 * - Le tableau s'arrête à la première ligne vide.
 * - Les titres de colonnes appris (règles de lecture) comptent comme ceux du
 *   scanner ; et quand rien n'est reconnu, l'utilisateur peut dire lui-même
 *   quelle colonne est l'étape, l'acteur… (`sheetToProcessWithColumns`).
 *
 * Fonctions pures, testées dans __tests__/simple.test.ts.
 */

import type { ImportResult } from '@/import/errors';
import {
  learnedHeaderKind,
  type ColumnKind,
  type LearnedHeaders,
  type ScannedTable,
  type TableColumn,
} from '@/scan/table';
import { tableToProcess } from '@/scan/to-process';

import { HEADER_SEARCH_ROWS, isFilled, isProcessHeader } from '../detect';
import { filledRows } from '../grid';
import type { Sheet } from '../types';

/** Pour chaque colonne de la ligne d'en-tête, son genre, ou null pour l'ignorer. */
export type ColumnChoice = (ColumnKind | null)[];

/** Le tableau à partir d'une ligne d'en-tête et du genre de chaque colonne. */
function buildTable(rows: string[][], headerIndex: number, choice: ColumnChoice): ScannedTable {
  // Une colonne par genre : si deux colonnes ont le même genre, la première gagne.
  const seen = new Set<ColumnKind>();
  const columns: (TableColumn & { index: number })[] = [];
  choice.forEach((kind, index) => {
    if (!kind || seen.has(kind)) return;
    seen.add(kind);
    columns.push({ kind, label: rows[headerIndex][index] ?? '', index });
  });

  const body: string[][] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (!isFilled(row)) break;
    body.push(columns.map(({ index }) => row[index] ?? ''));
  }

  return {
    columns: columns.map(({ kind, label }) => ({ kind, label })),
    rows: body,
    ignored: rows.filter(isFilled).length - body.length - 1,
    title: titleAbove(rows, headerIndex),
  };
}

/** Le tableau de process d'un onglet, au format du scanner ; null sans ligne d'en-tête reconnue. */
export function sheetToTable(sheet: Sheet, learned?: LearnedHeaders): ScannedTable | null {
  const rows = filledRows(sheet);
  const headerIndex = rows.slice(0, HEADER_SEARCH_ROWS).findIndex((row) => isProcessHeader(row, learned));
  if (headerIndex < 0) return null;
  return buildTable(
    rows,
    headerIndex,
    rows[headerIndex].map((label) => learnedHeaderKind(label, learned)),
  );
}

/** Un titre seul sur sa ligne, dans les trois lignes au-dessus de l'en-tête. */
function titleAbove(rows: string[][], headerIndex: number): string | undefined {
  for (let index = headerIndex - 1; index >= Math.max(0, headerIndex - 3); index--) {
    const cells = rows[index].filter(Boolean);
    if (cells.length === 1) return cells[0].replace(/\s+/g, ' ').trim();
    if (cells.length > 1) return undefined;
  }
  return undefined;
}

function toProcess(table: ScannedTable, sheet: Sheet, idPrefix: string): ImportResult {
  const result = tableToProcess(table, table.title ?? sheet.name, idPrefix);
  return {
    processes: result.processes.map((process) => ({ ...process, source: 'tableau' })),
    warnings: result.warnings,
  };
}

/** Le process d'un onglet « process » ; null si l'onglet n'en est pas un. */
export function sheetToProcess(sheet: Sheet, idPrefix: string, learned?: LearnedHeaders): ImportResult | null {
  const table = sheetToTable(sheet, learned);
  return table ? toProcess(table, sheet, idPrefix) : null;
}

/** La grille d'un onglet avec ses cellules fusionnées recopiées, pour choisir les colonnes. */
export const sheetGrid = filledRows;

/**
 * Le process d'un onglet dont l'utilisateur a choisi la ligne d'en-tête
 * (`headerIndex`, à partir de 0) et le genre de chaque colonne. Il faut au
 * moins la colonne de l'étape ; sinon null.
 */
export function sheetToProcessWithColumns(
  sheet: Sheet,
  headerIndex: number,
  choice: ColumnChoice,
  idPrefix: string,
): ImportResult | null {
  if (!choice.includes('step')) return null;
  const rows = filledRows(sheet);
  if (!rows[headerIndex]) return null;
  return toProcess(buildTable(rows, headerIndex, choice), sheet, idPrefix);
}

/** Première ligne remplie d'un onglet : la ligne d'en-tête proposée par défaut. */
export function firstFilledRow(sheet: Sheet): number {
  return Math.max(0, sheet.rows.findIndex(isFilled));
}
