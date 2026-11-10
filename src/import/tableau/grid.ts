/**
 * Outils sur la grille d'un onglet, communs aux modèles de lecture.
 * Fonctions pures, testées dans __tests__/grid.test.ts.
 */

import type { Sheet } from './types';

/**
 * Grille où chaque cellule fusionnée reprend le texte de la case en haut à
 * gauche : une colonne « Acteur » ou « Famille » fusionnée sur plusieurs
 * lignes s'applique ainsi à chacune d'elles.
 */
export function filledRows(sheet: Sheet): string[][] {
  const rows = sheet.rows.map((row) => [...row]);
  for (const merge of sheet.merges) {
    const value = rows[merge.top]?.[merge.left] ?? '';
    if (!value) continue;
    for (let row = merge.top; row <= merge.bottom && row < rows.length; row++) {
      for (let column = merge.left; column <= merge.right && column < rows[row].length; column++) {
        if (!rows[row][column]) rows[row][column] = value;
      }
    }
  }
  return rows;
}
