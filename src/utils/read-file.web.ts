/** Version web : le navigateur fournit directement le fichier choisi. */

import type { DocumentPickerAsset } from 'expo-document-picker';

export function readPickedFile(asset: DocumentPickerAsset): Promise<string> {
  return asset.file ? asset.file.text() : fetch(asset.uri).then((response) => response.text());
}

/** Les octets du fichier, pour les formats binaires (classeur Excel). */
export async function readPickedBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return new Uint8Array(buffer);
}
