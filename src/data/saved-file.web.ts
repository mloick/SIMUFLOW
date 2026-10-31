/** Version web : le navigateur garde le texte dans son stockage local. */

export function readSaved(name = 'process-importes'): string | null {
  return globalThis.localStorage?.getItem(`simuflow.${name}`) ?? null;
}

export function writeSaved(text: string, name = 'process-importes') {
  globalThis.localStorage?.setItem(`simuflow.${name}`, text);
}
