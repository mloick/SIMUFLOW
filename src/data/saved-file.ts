/**
 * Fichier où sont enregistrés les process importés, dans le dossier Documents
 * de l'application : le système ne le supprime pas, il disparaît seulement
 * quand l'app est désinstallée.
 */

import { File, Paths } from 'expo-file-system';

const file = () => new File(Paths.document, 'process-importes.json');

export function readSaved(): string | null {
  const saved = file();
  return saved.exists ? saved.textSync() : null;
}

export function writeSaved(text: string) {
  const saved = file();
  if (!saved.exists) saved.create();
  saved.writeSync(text);
}
