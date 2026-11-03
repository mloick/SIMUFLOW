import { describe, expect, it } from '@jest/globals';

import { eraseTableLines } from '../table-lines';

/** Une image blanche de `width` × `height` pixels. */
const blank = (width: number, height: number) => new Uint8ClampedArray(width * height).fill(255);

describe('traits du tableau effacés avant la lecture web', () => {
  it('efface un long trait horizontal et un long trait vertical', () => {
    const image = blank(100, 100);
    for (let x = 0; x < 100; x++) image[50 * 100 + x] = 0;
    for (let y = 0; y < 100; y++) image[y * 100 + 20] = 0;
    expect(eraseTableLines(image, 100, 100)).toBe(199);
    expect(image.every((value) => value === 255)).toBe(true);
  });

  it('garde les traits courts des lettres', () => {
    const image = blank(100, 100);
    // Un « l » de 9 pixels de haut et une barre de « t » de 4 pixels : plus courts que 12 % de l'image.
    for (let y = 10; y < 19; y++) image[y * 100 + 40] = 0;
    for (let x = 38; x < 42; x++) image[12 * 100 + x] = 0;
    expect(eraseTableLines(image, 100, 100)).toBe(0);
    expect(image[15 * 100 + 40]).toBe(0);
  });

  it('ne prend pas un fond clair coloré pour un trait', () => {
    // En-tête bleu très clair (gris 225) sur page blanche, avec un mot noir : le fond reste.
    const image = blank(100, 100);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 100; x++) image[y * 100 + x] = 225;
    for (let x = 10; x < 15; x++) image[10 * 100 + x] = 20;
    eraseTableLines(image, 100, 100);
    expect(image[5 * 100 + 50]).toBe(225);
  });
});
