/**
 * Le formulaire lu dans un template, le temps de l'afficher : l'écran
 * d'import le dépose ici avant d'ouvrir l'aperçu. Rien n'est enregistré,
 * comme le fichier lu, qui ne quitte pas l'appareil.
 */

import type { FormTemplate } from '@/import/tableau';

let shown: FormTemplate | null = null;

export function showForm(template: FormTemplate): void {
  shown = template;
}

export function getShownForm(): FormTemplate | null {
  return shown;
}
