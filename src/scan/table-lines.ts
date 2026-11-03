/**
 * Version web du Scanner : Tesseract lit mal le texte collé aux traits d'un
 * tableau (il prend la grille pour une image). Avant la lecture, on efface les
 * traits : toute suite de pixels sombres plus longue qu'un mot, à l'horizontale
 * ou à la verticale, est repeinte en blanc. Le texte, fait de traits courts,
 * reste. Fonction pure sur une image en niveaux de gris (0 noir, 255 blanc).
 */

/** Seuil entre « sombre » et « clair » : le milieu entre le plus sombre et le plus clair de l'image. */
function darkThreshold(gray: Uint8ClampedArray): number {
  let min = 255;
  let max = 0;
  for (const value of gray) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return (min + max) / 2;
}

/**
 * Efface en place les traits horizontaux plus longs que `minRatio` de la
 * largeur et les traits verticaux plus longs que `minRatio` de la hauteur.
 * Rend le nombre de pixels effacés.
 */
export function eraseTableLines(gray: Uint8ClampedArray, width: number, height: number, minRatio = 0.12): number {
  const threshold = darkThreshold(gray);
  const dark = (index: number) => gray[index] < threshold;
  const toErase = new Uint8Array(width * height);
  const minRow = Math.max(8, Math.round(width * minRatio));
  const minColumn = Math.max(8, Math.round(height * minRatio));

  for (let y = 0; y < height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const isDark = x < width && dark(y * width + x);
      if (isDark && start < 0) start = x;
      if (!isDark && start >= 0) {
        if (x - start >= minRow) for (let i = start; i < x; i++) toErase[y * width + i] = 1;
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      const isDark = y < height && dark(y * width + x);
      if (isDark && start < 0) start = y;
      if (!isDark && start >= 0) {
        if (y - start >= minColumn) for (let i = start; i < y; i++) toErase[i * width + x] = 1;
        start = -1;
      }
    }
  }

  let erased = 0;
  for (let i = 0; i < toErase.length; i++) {
    if (toErase[i]) {
      gray[i] = 255;
      erased++;
    }
  }
  return erased;
}
