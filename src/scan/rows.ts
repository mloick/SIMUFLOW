/**
 * Range le texte lu sur une photo (src/scan, module text-recognition) en
 * lignes de tableau : les morceaux à la même hauteur forment une ligne, lus
 * de gauche à droite. Fonctions pures, sans dépendance à l'appareil.
 */

import type { TextLine } from '../../modules/text-recognition';

/** Un morceau de texte d'une ligne, avec sa position horizontale (fraction de l'image). */
export type RowItem = { text: string; x: number; width: number };

export type TableRow = { cells: string[]; items: RowItem[]; y: number; height: number };

const centerY = (line: TextLine) => line.y + line.height / 2;

/**
 * Regroupe les morceaux en lignes. Un morceau rejoint la ligne en cours si son
 * centre est à moins de 60 % de la hauteur du texte de celui de la ligne : un
 * tableau photographié un peu de biais reste lisible.
 */
export function groupRows(lines: TextLine[]): TableRow[] {
  const sorted = lines.filter((line) => line.text.trim()).sort((a, b) => centerY(a) - centerY(b));
  const rows: { items: TextLine[]; center: number; height: number }[] = [];
  for (const line of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(centerY(line) - row.center) < 0.6 * Math.min(row.height, line.height)) {
      row.items.push(line);
      row.center = row.items.reduce((sum, item) => sum + centerY(item), 0) / row.items.length;
      row.height = Math.max(row.height, line.height);
    } else {
      rows.push({ items: [line], center: centerY(line), height: line.height });
    }
  }
  return rows.map((row) => {
    const items = row.items
      .sort((a, b) => a.x - b.x)
      .map((item) => ({ text: item.text.trim(), x: item.x, width: item.width }));
    return { cells: items.map((item) => item.text), items, y: row.center, height: row.height };
  });
}

/** « 5 lignes, 3 colonnes » : le nombre de colonnes est celui de la ligne la plus remplie. */
export function tableSize(rows: TableRow[]): { rows: number; columns: number } {
  return { rows: rows.length, columns: Math.max(0, ...rows.map((row) => row.cells.length)) };
}
