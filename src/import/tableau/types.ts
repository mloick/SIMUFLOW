/**
 * Un classeur lu, quel que soit son format (.xlsx, .csv) : des onglets, chacun
 * une grille de textes tels qu'Excel les affiche, plus ses cellules fusionnées.
 * Les modèles de lecture travaillent sur cette grille commune.
 */

/** Zone de cellules fusionnées, en indices à partir de 0 (bornes incluses). */
export type MergedRange = { top: number; left: number; bottom: number; right: number };

export type Sheet = {
  name: string;
  /** Une ligne par ligne du tableau, une case par colonne ; vide si rien n'est écrit. */
  rows: string[][];
  /** Cellules fusionnées : le texte n'est que dans la case en haut à gauche. */
  merges: MergedRange[];
  /** Onglet masqué dans Excel. */
  hidden?: boolean;
};

export type Workbook = {
  sheets: Sheet[];
  /** Points à signaler sans bloquer la lecture (onglet tronqué…). */
  warnings: string[];
};
