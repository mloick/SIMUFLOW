/**
 * Fichiers où l'app enregistre ses données (process importés, règles de
 * lecture), dans le dossier Documents de l'application : le système ne les
 * supprime pas, ils disparaissent seulement quand l'app est désinstallée.
 */

import { File, Paths } from 'expo-file-system';

const file = (name: string) => new File(Paths.document, `${name}.json`);

export function readSaved(name = 'process-importes'): string | null {
  const saved = file(name);
  return saved.exists ? saved.textSync() : null;
}

export function writeSaved(text: string, name = 'process-importes') {
  const saved = file(name);
  if (!saved.exists) saved.create();
  saved.writeSync(text);
}
