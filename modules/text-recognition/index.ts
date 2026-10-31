/**
 * Module natif local de SimuFlow : lecture du texte d'une photo, sur le
 * téléphone, sans réseau. iOS : Vision (ios/TextRecognitionModule.swift), qui
 * recadre d'abord la photo sur le document qu'elle montre.
 * Android (ML Kit) viendra ensuite ; en attendant, et sur le web, le module
 * est absent et `isTextRecognitionAvailable` vaut faux.
 */

import { requireOptionalNativeModule } from 'expo';

/** Un morceau de texte lu, et sa boîte en fraction de l'image (origine en haut à gauche). */
export type TextLine = {
  text: string;
  /** Confiance de la lecture, de 0 à 1. */
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Résultat d'une lecture : le texte, et l'image recadrée sur le document si la photo l'a été. */
export type TextReading = { lines: TextLine[]; uri?: string };

type TextRecognitionNative = {
  recognizeTextAsync(uri: string): Promise<TextReading>;
};

const native = requireOptionalNativeModule<TextRecognitionNative>('TextRecognition');

export const isTextRecognitionAvailable = native !== null;

/**
 * Lit le texte de la photo `uri` (fichier local, par exemple pris avec
 * expo-camera). Les boîtes sont en fraction de l'image lue : l'image recadrée
 * quand il y en a une.
 */
export async function recognizeText(uri: string): Promise<TextReading> {
  if (!native) throw new Error('La lecture du texte n’est pas encore disponible sur cet appareil.');
  return native.recognizeTextAsync(uri);
}
