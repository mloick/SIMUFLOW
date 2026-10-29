/** Erreur d'import, avec un message en français prêt à afficher. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** Résultat d'un import : un process par page, et les remarques à montrer. */
export type ImportResult = {
  processes: import('@/domain').Process[];
  /** Points à signaler sans bloquer l'import (page vide, flèche rattachée…). */
  warnings: string[];
};
