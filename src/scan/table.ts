/**
 * Trouve le tableau de process dans le texte lu sur une photo, et ignore tout
 * le reste (titre de la page, onglets du navigateur, notes sous le tableau).
 *
 * 1. La ligne d'en-tête est la première qui nomme au moins deux colonnes
 *    connues, dont l'étape : « Étape », « Tâche », « Acteur », « Responsable »,
 *    « Délai », « Durée », « N° », « Suite »…
 * 2. Chaque colonne commence là où commence son titre. Un texte est rangé dans
 *    la colonne dont le titre commence juste avant lui.
 * 3. Les lignes suivantes font partie du tableau tant qu'elles restent proches
 *    les unes des autres, écrites à peu près aussi gros que les titres, et
 *    qu'aucun texte ne déborde d'une colonne sur la suivante (une phrase sous
 *    le tableau déborde, une cellule jamais).
 * 4. Une ligne serrée contre la précédente avec du texte dans une seule colonne
 *    est la suite d'une cellule écrite sur deux lignes : elle la complète.
 *
 * Fonctions pures, testées dans __tests__/table.test.ts.
 */

import type { RowItem, TableRow } from './rows';

export type ColumnKind = 'number' | 'step' | 'actor' | 'delay' | 'next';

export type TableColumn = { kind: ColumnKind; label: string };

export type ScannedTable = {
  columns: TableColumn[];
  /** Une ligne par étape, une cellule par colonne (vide si rien n'est écrit). */
  rows: string[][];
  /** Lignes de texte lues hors du tableau, ignorées. */
  ignored: number;
};

/** Mots d'en-tête reconnus, sans accents ni majuscules. */
const HEADERS: Record<ColumnKind, string[]> = {
  number: ['n', 'no', 'num', 'numero', '#'],
  step: ['etape', 'etapes', 'tache', 'taches', 'activite', 'action', 'operation'],
  actor: ['acteur', 'acteurs', 'responsable', 'qui', 'service', 'role', 'equipe', 'porteur'],
  delay: ['delai', 'delais', 'duree', 'temps', 'charge'],
  next: ['suite', 'suivant', 'ensuite', 'apres', 'vers', 'etapesuivante'],
};

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9#]/g, '');

/** Le genre de colonne qu'annonce un titre, ou null. */
export function headerKind(text: string): ColumnKind | null {
  const word = normalize(text);
  for (const [kind, names] of Object.entries(HEADERS) as [ColumnKind, string[]][]) {
    if (names.includes(word)) return kind;
  }
  return null;
}

/** Marge pour ranger un texte dans une colonne : un « 1 » centré sous « N° » commence un peu après lui. */
const SLACK = 0.03;

type Column = TableColumn & { x: number };

/** La colonne d'un texte : celle dont le titre commence juste avant lui. */
function columnOf(item: RowItem, columns: Column[]): number {
  let found = 0;
  columns.forEach((column, index) => {
    if (column.x <= item.x + SLACK) found = index;
  });
  return found;
}

/** Vrai si le texte déborde de sa colonne sur la suivante (une phrase, pas une cellule). */
function overflows(item: RowItem, columns: Column[]): boolean {
  const next = columns[columnOf(item, columns) + 1];
  return next !== undefined && item.x + item.width > next.x + SLACK;
}

/** Le tableau trouvé dans les lignes lues, ou null s'il n'y a pas de ligne d'en-tête. */
export function findTable(rows: TableRow[]): ScannedTable | null {
  const headerIndex = rows.findIndex((row) => {
    const kinds = new Set(row.cells.map(headerKind).filter((kind) => kind !== null));
    return kinds.size >= 2 && kinds.has('step');
  });
  if (headerIndex < 0) return null;

  const header = rows[headerIndex];
  const columns: Column[] = header.items
    .map((item) => ({ kind: headerKind(item.text), label: item.text, x: item.x }))
    .filter((column): column is Column => column.kind !== null);
  const left = columns[0].x - SLACK;

  const table: string[][] = [];
  let previous = header;
  let lastIndex = headerIndex;
  let spacing = 0;
  for (const [index, row] of rows.entries()) {
    if (index <= headerIndex) continue;
    const gap = row.y - previous.y;
    // Trop loin de la ligne précédente : le tableau est fini.
    const limit = spacing ? 1.8 * spacing : 4 * Math.max(header.height, row.height);
    if (gap > limit) break;
    // Texte bien plus petit que les titres : une note sous le tableau.
    if (row.height < 0.7 * header.height) break;
    if (row.items.some((item) => item.x < left - SLACK || overflows(item, columns))) break;

    const cells = columns.map(() => '');
    for (const item of row.items) {
      const column = columnOf(item, columns);
      cells[column] = cells[column] ? `${cells[column]} ${item.text}` : item.text;
    }

    // Texte serré dans une seule colonne : la suite de la cellule du dessus.
    const filled = cells.filter(Boolean).length;
    const last = table.at(-1);
    if (last && spacing && filled === 1 && gap < 0.7 * spacing) {
      const column = cells.findIndex(Boolean);
      last[column] = last[column] ? `${last[column]} ${cells[column]}` : cells[column];
    } else {
      table.push(cells);
      if (!spacing) spacing = gap;
    }
    previous = row;
    lastIndex = index;
  }

  return {
    columns: columns.map(({ kind, label }) => ({ kind, label })),
    rows: table,
    // Lignes lues avant l'en-tête et après la dernière ligne gardée.
    ignored: rows.length - (lastIndex - headerIndex + 1),
  };
}
