/** Nombre écrit à la française : « 0,5 ». */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** « 1 étape », « 3 étapes », « 0,5 jour ». Le pluriel par défaut ajoute un « s ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`;
}

/** Texte sans accents ni majuscules, pour une recherche tolérante. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .trim();
}
