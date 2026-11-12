/**
 * Le formulaire lu dans un template, le temps de le remplir : l'écran
 * d'import le dépose ici avant d'ouvrir le formulaire, et les réponses de la
 * dernière demande prête y restent pour la suite. Rien n'est enregistré,
 * comme le fichier lu, qui ne quitte pas l'appareil.
 */

import type { FormAnswers, FormTemplate } from '@/import/tableau';

let shown: FormTemplate | null = null;
let sent: FormAnswers | null = null;

export function showForm(template: FormTemplate): void {
  shown = template;
  sent = null;
}

export function getShownForm(): FormTemplate | null {
  return shown;
}

/** Garde les réponses d'une demande prête (sans les questions cachées). */
export function keepSentAnswers(answers: FormAnswers): void {
  sent = answers;
}

export function getSentAnswers(): FormAnswers | null {
  return sent;
}
