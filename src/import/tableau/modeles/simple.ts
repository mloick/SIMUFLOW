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
 *
 * Fonctions pures, testées dans __tests__/simple.test.ts.
 */

import type { ImportResult } from '@/import/errors';
import { headerKind, type ColumnKind, type ScannedTable, type TableColumn } from '@/scan/table';
import { tableToProcess } from '@/scan/to-process';

import { HEADER_SEARCH_ROWS, isFilled, isProcessHeader } from '../detect';
import { filledRows } from '../grid';
import type { Sheet } from '../types';

/** Le tableau de process d'un onglet, au format du scanner ; null sans ligne d'en-tête reconnue. */
export function sheetToTable(sheet: Sheet): ScannedTable | null {
  const rows = filledRows(sheet);
  const headerIndex = rows.slice(0, HEADER_SEARCH_ROWS).findIndex(isProcessHeader);
  if (headerIndex < 0) return null;

  // Une colonne par genre : si deux titres annoncent le même genre, le premier gagne.
  const seen = new Set<ColumnKind>();
  const columns: (TableColumn & { index: number })[] = [];
  rows[headerIndex].forEach((label, index) => {
    const kind = headerKind(label);
    if (!kind || seen.has(kind)) return;
    seen.add(kind);
    columns.push({ kind, label, index });
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

/** Un titre seul sur sa ligne, dans les trois lignes au-dessus de l'en-tête. */
function titleAbove(rows: string[][], headerIndex: number): string | undefined {
  for (let index = headerIndex - 1; index >= Math.max(0, headerIndex - 3); index--) {
    const cells = rows[index].filter(Boolean);
    if (cells.length === 1) return cells[0].replace(/\s+/g, ' ').trim();
    if (cells.length > 1) return undefined;
  }
  return undefined;
}

/** Le process d'un onglet « process » ; null si l'onglet n'en est pas un. */
export function sheetToProcess(sheet: Sheet, idPrefix: string): ImportResult | null {
  const table = sheetToTable(sheet);
  if (!table) return null;
  const result = tableToProcess(table, table.title ?? sheet.name, idPrefix);
  return {
    processes: result.processes.map((process) => ({ ...process, source: 'tableau' })),
    warnings: result.warnings,
  };
}
