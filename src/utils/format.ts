/** « 1 étape », « 3 étapes ». Le pluriel par défaut ajoute un « s ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
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
