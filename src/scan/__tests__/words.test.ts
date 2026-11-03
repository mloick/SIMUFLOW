import { describe, expect, it } from '@jest/globals';

import { groupRows } from '../rows';
import { findTable } from '../table';
import { wordsToTextLines, type OcrLine, type OcrWord } from '../words';

/** Un mot de 20 px de haut à la position `x` (pixels), sur la ligne `y`. */
const word = (text: string, x: number, y: number, confidence = 90): OcrWord => ({
  text,
  confidence,
  bbox: { x0: x, y0: y, x1: x + text.length * 10, y1: y + 20 },
});

/** Une ligne de mots, chacun donné comme [texte, x]. */
const line = (y: number, ...words: [string, number][]): OcrLine => ({ words: words.map(([text, x]) => word(text, x, y)) });

describe('mots lus dans le navigateur (Tesseract)', () => {
  it('coupe une ligne en cases aux grands espaces et garde les mots proches ensemble', () => {
    const [first, second] = wordsToTextLines([line(100, ['Recevoir', 0], ['la', 85], ['demande', 110], ['Accueil', 400])], 1000, 500);
    expect(first.text).toBe('Recevoir la demande');
    expect(second.text).toBe('Accueil');
  });

  it('donne les boîtes en fraction de l’image et la confiance de 0 à 1', () => {
    const [piece] = wordsToTextLines([{ words: [word('Délai', 500, 100, 80)] }], 1000, 500);
    expect(piece).toEqual({ text: 'Délai', confidence: 0.8, x: 0.5, y: 0.2, width: 0.05, height: 0.04 });
  });

  it('remet « JO » quand Tesseract le colle au nombre ou lit un zéro', () => {
    const pieces = wordsToTextLines([line(100, ['1J0', 0], ['0,5J0', 300], ['2', 600], ['JO', 615])], 1000, 500);
    expect(pieces.map((piece) => piece.text)).toEqual(['1 JO', '0,5 JO', '2 JO']);
  });

  it('ignore les traits du tableau lus comme du texte et les lignes vides', () => {
    const pieces = wordsToTextLines([line(100, ['|', 0], ['Étape', 20], ['—', 200]), { words: [] }], 1000, 500);
    expect(pieces.map((piece) => piece.text)).toEqual(['Étape']);
  });

  it('donne un tableau que findTable reconnaît', () => {
    const lines = [
      line(0, ['Demande', 0], ['de', 80], ['matériel', 110]),
      line(100, ['Étape', 0], ['Acteur', 400], ['Délai', 700]),
      line(150, ['Recevoir', 0], ['la', 85], ['demande', 110], ['Accueil', 400], ['1', 700], ['JO', 715]),
      line(200, ['Valider', 0], ['Manager', 400], ['2', 700], ['JO', 715]),
    ];
    const table = findTable(groupRows(wordsToTextLines(lines, 1000, 500)));
    expect(table?.rows).toEqual([
      ['Recevoir la demande', 'Accueil', '1 JO'],
      ['Valider', 'Manager', '2 JO'],
    ]);
  });
});

describe('hauteur du texte', () => {
  it('donne la même hauteur aux mots d’une même taille, accents ou non', () => {
    const accent: OcrLine = {
      words: [{ text: 'Étape', confidence: 96, bbox: { x0: 0, y0: 300, x1: 100, y1: 352 } }],
      baseline: { y0: 342, y1: 342 },
      rowAttributes: { rowHeight: 51, ascenders: 16, descenders: 9 },
    };
    const plain: OcrLine = {
      words: [{ text: 'Commander', confidence: 95, bbox: { x0: 0, y0: 625, x1: 200, y1: 659 } }],
      baseline: { y0: 659, y1: 659 },
      rowAttributes: { rowHeight: 39.4, ascenders: 8, descenders: 5.4 },
    };
    const [header, row] = wordsToTextLines([accent, plain], 1000, 1000);
    // Hauteur des minuscules : 26 px pour les deux ; bande de 1,8 fois cette hauteur autour de la ligne de base.
    expect(header.height).toBeCloseTo(0.0468);
    expect(row.height).toBeCloseTo(0.0468);
    expect(header.y + header.height).toBeCloseTo(0.342 + 0.3 * 0.026);
  });
});
