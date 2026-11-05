/**
 * Lecture d'un classeur Excel (.xlsx, .xlsm), entièrement sur l'appareil.
 *
 * Un .xlsx est un ZIP de fichiers XML. On n'en ouvre que ce qui sert :
 * - xl/workbook.xml : les onglets, dans l'ordre, et ceux qui sont masqués ;
 * - xl/_rels/workbook.xml.rels : le fichier XML de chaque onglet ;
 * - xl/sharedStrings.xml : les textes, rangés une seule fois pour tout le classeur ;
 * - xl/styles.xml : seulement pour savoir quels nombres sont des dates ;
 * - xl/worksheets/sheetN.xml : les cellules et les cellules fusionnées.
 * Les images, graphiques et mises en forme sont ignorés. Une formule n'est pas
 * recalculée : on prend la valeur qu'Excel a enregistrée avec elle, celle qui
 * s'affiche.
 *
 * Les anciens .xls et les classeurs protégés par mot de passe ne sont pas des
 * ZIP (ils commencent par la signature D0 CF 11 E0) : message clair.
 *
 * Fonctions pures, testées dans __tests__/xlsx.test.ts.
 */

import { DOMParser, type Element } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';

import { ImportError } from '../errors';

import type { MergedRange, Sheet, Workbook } from './types';

/** Au-delà, l'onglet est tronqué (avec une remarque) pour ne pas bloquer l'app. */
export const MAX_ROWS = 5000;
export const MAX_COLUMNS = 500;

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLD_OFFICE = [0xd0, 0xcf, 0x11, 0xe0];

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, index) => bytes[index] === byte);

/** Vrai si les octets sont ceux d'un ancien fichier Office (.xls) ou d'un classeur protégé par mot de passe. */
export function isOldOfficeFile(bytes: Uint8Array): boolean {
  return startsWith(bytes, OLD_OFFICE);
}

/** Vrai si les octets sont ceux d'un ZIP (.xlsx, .xlsm, mais aussi .docx, .ods…). */
export function isZip(bytes: Uint8Array): boolean {
  return startsWith(bytes, ZIP);
}

/** Les éléments d'un nom donné, avec ou sans préfixe d'espace de noms (« x:c » ou « c »). */
function elements(parent: Element | Document | undefined | null, name: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.getElementsByTagNameNS('*', name) as unknown as ArrayLike<Element>);
}

/** Les enfants directs d'un nom donné. */
function children(parent: Element, name: string): Element[] {
  return Array.from(parent.childNodes as unknown as ArrayLike<Element>).filter(
    (node) => node.nodeType === 1 && (node.localName ?? node.nodeName) === name,
  );
}

/** Attribut de la relation (« r:id »), quel que soit le préfixe choisi par le logiciel. */
function relationId(element: Element): string | null {
  for (const attribute of Array.from(element.attributes as unknown as ArrayLike<Attr>)) {
    if (attribute.localName === 'id' && attribute.prefix) return attribute.value;
  }
  return null;
}

function parseXml(text: string): Document {
  return new DOMParser({ onError: () => undefined }).parseFromString(text, 'text/xml') as unknown as Document;
}

/** Texte d'une cellule : retours à la ligne gardés, caractères échappés par Excel (« _x000D_ ») remis. */
function clean(text: string): string {
  return text
    .replace(/_x([0-9a-f]{4})_/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\r\n?/g, '\n')
    .trim();
}

/** Texte d'un élément <si> ou <is> : ses <t>, directs ou dans des morceaux <r>, sans la phonétique <rPh>. */
function richText(element: Element): string {
  const parts: string[] = [];
  for (const child of children(element, 't')) parts.push(child.textContent ?? '');
  for (const run of children(element, 'r')) for (const child of children(run, 't')) parts.push(child.textContent ?? '');
  return parts.join('');
}

/** « B12 » → { row: 11, column: 1 }. */
export function cellPosition(reference: string): { row: number; column: number } | null {
  const match = reference.match(/^\$?([A-Z]{1,3})\$?(\d+)$/i);
  if (!match) return null;
  let column = 0;
  for (const letter of match[1].toUpperCase()) column = column * 26 + (letter.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, column: column - 1 };
}

/** « A1:C3 » → la zone, en indices à partir de 0. */
export function rangeOf(reference: string): MergedRange | null {
  const [from, to = from] = reference.split(':');
  const start = cellPosition(from);
  const end = cellPosition(to);
  if (!start || !end) return null;
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.column, end.column),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.column, end.column),
  };
}

/** Formats de nombre intégrés à Excel qui affichent une date ou une heure. */
const BUILT_IN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57, 58]);

/** Vrai si un format de nombre personnalisé affiche une date (« dd/mm/yyyy », « [$-fr-FR]d mmm »…). */
export function isDateFormat(code: string): boolean {
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
  return /[dmyhs]/i.test(bare) && !/^general$/i.test(bare.trim());
}

/** Pour chaque style de cellule (attribut s), vrai s'il affiche une date. */
function dateStyles(styles: Document | null): boolean[] {
  if (!styles) return [];
  const custom = new Map<number, boolean>();
  for (const format of elements(styles, 'numFmt')) {
    custom.set(Number(format.getAttribute('numFmtId')), isDateFormat(format.getAttribute('formatCode') ?? ''));
  }
  const cellXfs = elements(styles, 'cellXfs')[0];
  if (!cellXfs) return [];
  return children(cellXfs, 'xf').map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    return custom.get(id) ?? BUILT_IN_DATES.has(id);
  });
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Numéro de série Excel → « 05/11/2026 » (et l'heure si elle n'est pas minuit). */
export function excelDate(serial: number, date1904 = false): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.round(serial * 86400) * 1000);
  const day = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return minutes ? `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}` : day;
}

/** Nombre tel qu'on l'écrirait : sans les bruits de calcul (0,1 + 0,2). */
function numberText(raw: string): string {
  const value = Number(raw);
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : raw;
}

type Context = { strings: string[]; dates: boolean[]; date1904: boolean };

/** Valeur affichée d'une cellule <c>. */
function cellValue(cell: Element, context: Context): string {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    const inline = children(cell, 'is')[0];
    return inline ? clean(richText(inline)) : '';
  }
  const raw = children(cell, 'v')[0]?.textContent ?? '';
  if (raw === '') return '';
  switch (type) {
    case 's':
      return clean(context.strings[Number(raw)] ?? '');
    case 'b':
      return raw === '1' ? 'VRAI' : 'FAUX';
    case 'str':
    case 'e':
      return clean(raw);
    default: {
      const style = Number(cell.getAttribute('s') ?? 0);
      if (context.dates[style] && Number.isFinite(Number(raw))) return excelDate(Number(raw), context.date1904);
      return numberText(raw);
    }
  }
}

/** Lit un onglet : sa grille de textes et ses cellules fusionnées. */
function readSheet(document: Document, name: string, context: Context, warnings: string[]): Sheet {
  const grid: string[][] = [];
  let truncated = false;
  let nextRow = 0;
  for (const row of elements(document, 'row')) {
    const rowIndex = row.getAttribute('r') ? Number(row.getAttribute('r')) - 1 : nextRow;
    nextRow = rowIndex + 1;
    if (rowIndex >= MAX_ROWS) {
      truncated = true;
      break;
    }
    let nextColumn = 0;
    for (const cell of children(row, 'c')) {
      const reference = cell.getAttribute('r');
      const column = (reference ? cellPosition(reference)?.column : undefined) ?? nextColumn;
      nextColumn = column + 1;
      if (column >= MAX_COLUMNS) {
        truncated = true;
        continue;
      }
      const value = cellValue(cell, context);
      if (!value) continue;
      (grid[rowIndex] ??= [])[column] = value;
    }
  }
  if (truncated) {
    warnings.push(`Onglet « ${name} » : seules les ${MAX_ROWS} premières lignes et ${MAX_COLUMNS} premières colonnes sont lues.`);
  }

  const merges = elements(document, 'mergeCell')
    .map((merge) => rangeOf(merge.getAttribute('ref') ?? ''))
    .filter((range): range is MergedRange => range !== null && range.top < MAX_ROWS && range.left < MAX_COLUMNS);

  return { name, rows: squareGrid(grid), merges };
}

/** Grille rectangulaire : cases vides remplies par « », lignes et colonnes vides de la fin retirées. */
export function squareGrid(grid: (string | undefined)[][]): string[][] {
  let height = 0;
  let width = 0;
  grid.forEach((row, rowIndex) => {
    row?.forEach((value, column) => {
      if (!value) return;
      height = Math.max(height, rowIndex + 1);
      width = Math.max(width, column + 1);
    });
  });
  return Array.from({ length: height }, (_, rowIndex) =>
    Array.from({ length: width }, (_, column) => grid[rowIndex]?.[column] ?? ''),
  );
}

/** Chemin d'un fichier du ZIP désigné par une relation, relative à xl/ ou absolue. */
function resolvePath(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = `xl/${target}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  return resolved.join('/');
}

/** Fichiers du ZIP qui servent ; tout le reste (images, graphiques…) n'est même pas décompressé. */
const isUseful = (name: string) =>
  name === 'xl/workbook.xml' ||
  name === 'xl/workbook.bin' ||
  name === 'xl/_rels/workbook.xml.rels' ||
  name === 'xl/sharedStrings.xml' ||
  name === 'xl/styles.xml' ||
  /^xl\/worksheets\/[^/]+\.xml$/.test(name) ||
  name === 'content.xml';

/** Lit un classeur .xlsx ou .xlsm. Lève une ImportError avec un message clair sinon. */
export function readXlsx(bytes: Uint8Array): Workbook {
  if (isOldOfficeFile(bytes)) {
    throw new ImportError(
      'Ce classeur est au format Excel ancien (.xls) ou protégé par un mot de passe. Ouvrez-le dans Excel, retirez le mot de passe s’il y en a un, puis enregistrez-le au format .xlsx.',
    );
  }
  if (!isZip(bytes)) throw new ImportError('Ce fichier n’est pas un classeur Excel lisible (.xlsx).');

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => isUseful(file.name) });
  } catch {
    throw new ImportError('Ce classeur est abîmé : il n’a pas pu être ouvert.');
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null);

  if (files['xl/workbook.bin']) {
    throw new ImportError('Ce classeur est au format binaire (.xlsb). Enregistrez-le au format .xlsx dans Excel.');
  }
  if (files['content.xml']) {
    throw new ImportError('Ce fichier vient de LibreOffice (.ods). Enregistrez-le au format .xlsx.');
  }
  const workbookXml = text('xl/workbook.xml');
  if (!workbookXml) throw new ImportError('Ce fichier n’est pas un classeur Excel (.xlsx).');

  const workbook = parseXml(workbookXml);
  const relations = new Map<string, string>();
  const relsXml = text('xl/_rels/workbook.xml.rels');
  if (relsXml) {
    for (const relation of elements(parseXml(relsXml), 'Relationship')) {
      relations.set(relation.getAttribute('Id') ?? '', resolvePath(relation.getAttribute('Target') ?? ''));
    }
  }

  const stringsXml = text('xl/sharedStrings.xml');
  const stylesXml = text('xl/styles.xml');
  const properties = elements(workbook, 'workbookPr')[0];
  const date1904 = ['1', 'true'].includes(properties?.getAttribute('date1904') ?? '');
  const context: Context = {
    strings: stringsXml ? elements(parseXml(stringsXml), 'si').map(richText) : [],
    dates: dateStyles(stylesXml ? parseXml(stylesXml) : null),
    date1904,
  };

  const warnings: string[] = [];
  const sheets: Sheet[] = [];
  elements(workbook, 'sheet').forEach((entry, index) => {
    const name = entry.getAttribute('name') ?? `Onglet ${index + 1}`;
    const path = relations.get(relationId(entry) ?? '') ?? `xl/worksheets/sheet${index + 1}.xml`;
    const sheetXml = text(path);
    // Pas de fichier de feuille : un onglet graphique, sans cellules.
    if (!sheetXml) return;
    const sheet = readSheet(parseXml(sheetXml), name, context, warnings);
    const state = entry.getAttribute('state');
    if (state === 'hidden' || state === 'veryHidden') sheet.hidden = true;
    sheets.push(sheet);
  });

  if (sheets.length === 0) throw new ImportError('Ce classeur ne contient aucun onglet lisible.');
  return { sheets, warnings };
}
