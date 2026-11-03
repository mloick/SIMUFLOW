/**
 * Version web du Scanner : Tesseract (dans le navigateur) rend des lignes de
 * mots avec leur boîte en pixels. On les découpe en morceaux comme ML Kit sur
 * Android : deux mots séparés par plus que la hauteur du texte sont dans
 * deux cases différentes du tableau. Le résultat a la même forme que celui du
 * module natif, pour que groupRows et findTable marchent sans changement.
 * Fonction pure, sans dépendance au navigateur.
 */

import type { TextLine } from '../../modules/text-recognition';

/** Un mot lu, avec sa boîte en pixels et sa confiance de 0 à 100 (format Tesseract). */
export type OcrWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };

/**
 * Une ligne lue par Tesseract : ses mots, de gauche à droite, et, si Tesseract
 * les donne, sa ligne de base et ses mesures (hauteur, jambages).
 */
export type OcrLine = {
  words: OcrWord[];
  baseline?: { y0: number; y1: number };
  rowAttributes?: { rowHeight: number; ascenders: number; descenders: number };
};

/**
 * Haut et bas du texte de la ligne. La boîte d'un mot dépend de ses lettres
 * (« Étape » est plus haute que « Commander », à cause de l'accent) : on part
 * plutôt de la hauteur des minuscules et de la ligne de base, pareilles pour
 * tous les mots d'une même taille, et on en tire une bande de la hauteur d'une
 * ligne de texte (majuscules et jambages compris, comme les boîtes de Vision).
 * Sans ces mesures, la boîte des mots.
 */
function textBand(line: OcrLine, piece: OcrWord[]): { top: number; bottom: number } {
  const row = line.rowAttributes;
  const xHeight = row ? row.rowHeight - row.ascenders - row.descenders : 0;
  if (line.baseline && xHeight > 0) {
    const baseline = (line.baseline.y0 + line.baseline.y1) / 2;
    return { top: baseline - 1.5 * xHeight, bottom: baseline + 0.3 * xHeight };
  }
  return { top: Math.min(...piece.map((word) => word.bbox.y0)), bottom: Math.max(...piece.map((word) => word.bbox.y1)) };
}

/** « 1J0 », « 0,5J0 » : Tesseract colle souvent le nombre à « JO » et lit le O comme un zéro. */
const fixDelay = (text: string) => text.replace(/(\d+(?:[.,]\d+)?)\s*J[O0]+(?![\p{L}\p{N}])/gu, '$1 JO');

/** Un mot sans lettre ni chiffre (« | », « — », « . ») : un trait du tableau lu comme du texte. */
const isNoise = (text: string) => !/[\p{L}\p{N}]/u.test(text);

/**
 * Découpe les lignes en morceaux de texte (une case de tableau chacun), avec
 * leur boîte en fraction de l'image (`width` × `height` pixels) et leur
 * confiance de 0 à 1.
 */
export function wordsToTextLines(lines: OcrLine[], width: number, height: number): TextLine[] {
  const result: TextLine[] = [];
  for (const line of lines) {
    const words = line.words.filter((word) => word.text.trim() && !isNoise(word.text)).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (words.length === 0) continue;
    const heights = words.map((word) => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b);
    // Plus large qu'une espace entre deux mots, plus étroit que l'écart entre deux colonnes (même « N° | Étape »).
    const gap = heights[Math.floor(heights.length / 2)];
    let piece: OcrWord[] = [];
    const flush = () => {
      if (piece.length === 0) return;
      const x0 = Math.min(...piece.map((word) => word.bbox.x0));
      const x1 = Math.max(...piece.map((word) => word.bbox.x1));
      const { top: y0, bottom: y1 } = textBand(line, piece);
      result.push({
        text: fixDelay(piece.map((word) => word.text.trim()).join(' ')),
        confidence: piece.reduce((sum, word) => sum + word.confidence, 0) / piece.length / 100,
        x: x0 / width,
        y: y0 / height,
        width: (x1 - x0) / width,
        height: (y1 - y0) / height,
      });
      piece = [];
    };
    for (const word of words) {
      const previous = piece.at(-1);
      if (previous && word.bbox.x0 - previous.bbox.x1 > gap) flush();
      piece.push(word);
    }
    flush();
  }
  return result;
}
