/**
 * Ce que contient chaque onglet d'un classeur, deviné sans rien demander :
 *
 * - « process » : une ligne d'en-tête qui nomme au moins deux colonnes connues
 *   du scanner, dont l'étape (N°, Étape, Acteur, Délai, Suite et leurs synonymes) ;
 * - « sla-ola » : une ligne d'en-tête qui parle de SLA, d'OLA et de groupe
 *   (groupe de compétence, assignment group) : un workflow d'outil de tickets,
 *   une ligne par situation ;
 * - « formulaire » : un onglet d'un template de formulaire de catalogue
 *   (Basic info, Questions, Fulfillment flow, Assignment & Summary, Values…),
 *   reconnu quand le classeur en contient au moins trois ;
 * - « liste » : deux colonnes remplies au plus, une simple liste de valeurs ;
 * - « vide », ou « inconnu » quand rien de tout cela ne colle.
 *
 * La lecture de chaque modèle viendra ensuite ; ici on ne fait que reconnaître.
 * Fonctions pures, testées dans __tests__/detect.test.ts.
 */

import { learnedHeaderKind, type LearnedHeaders } from '@/scan/table';

import type { Sheet, Workbook } from './types';

export type SheetKind = 'process' | 'sla-ola' | 'formulaire' | 'liste' | 'vide' | 'inconnu';

export type SheetReport = {
  name: string;
  kind: SheetKind;
  /** Lignes remplies sous l'en-tête (étapes ou situations), ou lignes remplies de l'onglet. */
  rowCount: number;
  columnCount: number;
  mergedCount: number;
  /** Numéro (à partir de 1) de la ligne d'en-tête trouvée. */
  headerRow?: number;
  hidden?: boolean;
};

export type WorkbookKind = 'process' | 'workflow' | 'formulaire' | 'inconnu';

export type WorkbookReport = { kind: WorkbookKind; sheets: SheetReport[] };

/** Seules les premières lignes sont fouillées pour trouver l'en-tête (un titre peut le précéder). */
export const HEADER_SEARCH_ROWS = 30;

/** Minuscules, sans accents, espaces simples. */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Noms des onglets d'un template de formulaire, sans numéro ni ponctuation. */
const TEMPLATE_SHEETS = [
  'basic info',
  'basic information',
  'catalog location',
  'location',
  'questions',
  'variables',
  'access',
  'fulfillment flow',
  'fulfilment flow',
  'assignment summary',
  'assignment',
  'values',
  'reference values',
];

/** « 3. Fulfillment flow » → « fulfillment flow ». */
const bareSheetName = (name: string) =>
  normalize(name)
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isTemplateSheet = (name: string) => TEMPLATE_SHEETS.includes(bareSheetName(name));

/** Vrai si la ligne est l'en-tête d'un workflow à SLA et OLA. */
export function isSlaOlaHeader(row: string[]): boolean {
  const text = normalize(row.join(' | '));
  // « Groupe de compétence », « Assignment group »…
  return /\bsla\b/.test(text) && /\bola\b/.test(text) && /\bgroupe?s?\b/.test(text);
}

/** Vrai si la ligne est l'en-tête d'un tableau de process (colonnes du scanner). */
export function isProcessHeader(row: string[], learned?: LearnedHeaders): boolean {
  const kinds = new Set(row.map((cell) => learnedHeaderKind(cell, learned)).filter((kind) => kind !== null));
  return kinds.size >= 2 && kinds.has('step');
}

export const isFilled = (row: string[]) => row.some(Boolean);

/** Lignes remplies sous l'en-tête, jusqu'à la première ligne vide. */
function rowsBelow(sheet: Sheet, headerIndex: number): number {
  let count = 0;
  for (const row of sheet.rows.slice(headerIndex + 1)) {
    if (!isFilled(row)) break;
    count++;
  }
  return count;
}

function findHeader(sheet: Sheet, test: (row: string[]) => boolean): number {
  return sheet.rows.slice(0, HEADER_SEARCH_ROWS).findIndex(test);
}

/** Ce que contient un onglet. `template` : le classeur est un template de formulaire. */
export function describeSheet(sheet: Sheet, template = false, learned?: LearnedHeaders): SheetReport {
  const columnCount = sheet.rows[0]?.length ?? 0;
  const base = {
    name: sheet.name,
    columnCount,
    mergedCount: sheet.merges.length,
    ...(sheet.hidden ? { hidden: true } : {}),
  };
  const filledRows = sheet.rows.filter(isFilled).length;
  if (filledRows === 0) return { ...base, kind: 'vide', rowCount: 0 };

  for (const [kind, test] of [
    ['sla-ola', isSlaOlaHeader],
    ['process', (row: string[]) => isProcessHeader(row, learned)],
  ] as const) {
    const header = findHeader(sheet, test);
    if (header >= 0) return { ...base, kind, rowCount: rowsBelow(sheet, header), headerRow: header + 1 };
  }

  if (template && isTemplateSheet(sheet.name)) return { ...base, kind: 'formulaire', rowCount: filledRows };

  const usedColumns = Array.from({ length: columnCount }, (_, column) =>
    sheet.rows.some((row) => row[column]),
  ).filter(Boolean).length;
  if (usedColumns <= 2) return { ...base, kind: 'liste', rowCount: filledRows };

  return { ...base, kind: 'inconnu', rowCount: filledRows };
}

/** Ce que contient le classeur : chaque onglet, et le genre de fichier dans son ensemble. */
export function describeWorkbook(workbook: Workbook, learned?: LearnedHeaders): WorkbookReport {
  const template = workbook.sheets.filter((sheet) => isTemplateSheet(sheet.name)).length >= 3;
  const sheets = workbook.sheets.map((sheet) => describeSheet(sheet, template, learned));
  const has = (kind: SheetKind) => sheets.some((sheet) => sheet.kind === kind);
  const kind: WorkbookKind = has('sla-ola')
    ? 'workflow'
    : template
      ? 'formulaire'
      : has('process')
        ? 'process'
        : 'inconnu';
  return { kind, sheets };
}

/** Libellé d'un genre d'onglet, pour l'écran. */
export const SHEET_KIND_LABELS: Record<SheetKind, string> = {
  process: 'Process',
  'sla-ola': 'SLA / OLA',
  formulaire: 'Formulaire',
  liste: 'Liste',
  vide: 'Vide',
  inconnu: 'Non reconnu',
};

/** Libellé du genre de classeur, pour l'écran. */
export const WORKBOOK_KIND_LABELS: Record<WorkbookKind, string> = {
  process: 'Tableau de process',
  workflow: 'Workflow avec SLA et OLA',
  formulaire: 'Template de formulaire',
  inconnu: 'Tableau non reconnu',
};
