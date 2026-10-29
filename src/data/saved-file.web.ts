/** Version web : le navigateur garde le texte dans son stockage local. */

const KEY = 'simuflow.process-importes';

export function readSaved(): string | null {
  return globalThis.localStorage?.getItem(KEY) ?? null;
}

export function writeSaved(text: string) {
  globalThis.localStorage?.setItem(KEY, text);
}
