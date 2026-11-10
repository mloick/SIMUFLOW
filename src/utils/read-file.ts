/**
 * Lit un fichier choisi avec le sélecteur de documents (iOS, Android).
 * Le sélecteur en a fait une copie dans le cache de l'application.
 */

import type { DocumentPickerAsset } from 'expo-document-picker';
import { File } from 'expo-file-system';

export function readPickedFile(asset: DocumentPickerAsset): Promise<string> {
  return new File(asset.uri).text();
}

/** Les octets du fichier, pour les formats binaires (classeur Excel). */
export function readPickedBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  return new File(asset.uri).bytes();
}
