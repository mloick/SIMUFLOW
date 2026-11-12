/**
 * Moteur de lecture des tableaux (Excel, CSV) : ouvre le fichier en une grille
 * commune, puis dit ce que contient chaque onglet. Tout se passe sur
 * l'appareil ; le fichier n'est ni envoyé ni gardé.
 */

import type { LearnedHeaders } from '@/scan/table';

import { ImportError, type ImportResult } from '../errors';

import { readCsv } from './csv';
import { describeWorkbook } from './detect';
import { sheetToProcess } from './modeles/simple';
import { isOldOfficeFile, isZip, readXlsx } from './xlsx';
import type { Workbook } from './types';

export { describeSheet, describeWorkbook, SHEET_KIND_LABELS, WORKBOOK_KIND_LABELS } from './detect';
export type { SheetKind, SheetReport, WorkbookKind, WorkbookReport } from './detect';
export type { MergedRange, Sheet, Workbook } from './types';
export { readCsv, readXlsx };
export {
  firstFilledRow,
  sheetGrid,
  sheetToProcess,
  sheetToProcessWithColumns,
  sheetToTable,
  type ColumnChoice,
} from './modeles/simple';

/** Types de fichiers proposés par le sélecteur de documents. */
export const TABLE_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'text/tab-separated-values',
  'text/plain',
];

/** Lit un tableau, d'après son extension puis ses premiers octets. */
export function readTableFile(fileName: string, bytes: Uint8Array): Workbook {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (extension === 'numbers') {
    throw new ImportError('Ce fichier vient de Numbers. Exportez-le au format Excel (.xlsx) ou CSV.');
  }
  if (['csv', 'tsv', 'txt'].includes(extension)) return readCsv(bytes, fileName);
  if (['xlsx', 'xlsm', 'xls'].includes(extension) || isZip(bytes) || isOldOfficeFile(bytes)) return readXlsx(bytes);
  throw new ImportError('Format non reconnu : choisissez un fichier Excel (.xlsx) ou CSV.');
}

/**
 * Les process d'un classeur : un par onglet reconnu comme tableau de process.
 * Les remarques d'un onglet sont précédées de son nom quand il y en a plusieurs
 * (celles de la lecture du classeur restent dans `workbook.warnings`).
 * Les autres genres d'onglets (SLA / OLA, formulaire) seront lus plus tard.
 */
export function workbookToProcesses(workbook: Workbook, idPrefix: string, learned?: LearnedHeaders): ImportResult {
  const report = describeWorkbook(workbook, learned);
  const sheets = workbook.sheets.filter((_, index) => report.sheets[index].kind === 'process');
  const result: ImportResult = { processes: [], warnings: [] };
  sheets.forEach((sheet, index) => {
    const read = sheetToProcess(sheet, `${idPrefix}-${index + 1}`, learned);
    if (!read) return;
    result.processes.push(...read.processes);
    const prefix = sheets.length > 1 ? `${sheet.name} : ` : '';
    result.warnings.push(...read.warnings.map((warning) => prefix + warning));
  });
  return result;
}
