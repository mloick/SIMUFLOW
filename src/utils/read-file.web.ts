/** Version web : le navigateur fournit directement le fichier choisi. */

import type { DocumentPickerAsset } from 'expo-document-picker';

export function readPickedFile(asset: DocumentPickerAsset): Promise<string> {
  return asset.file ? asset.file.text() : fetch(asset.uri).then((response) => response.text());
}
