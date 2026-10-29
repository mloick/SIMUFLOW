/**
 * Texte lisible à partir du libellé d'une forme draw.io, qui peut contenir du
 * HTML (« <b>Valider</b><br>2 JO »). Pas de DOM dans l'app : on traite les
 * balises et les entités à la main.
 */
export function cellText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>|<\/div>|<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Délai écrit dans le texte d'une étape : « 2 JO », « 1,5 jour ouvré », « 3 BD ». */
export function durationOf(text: string): number | undefined {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(JO|jours? ouvr[ée]s?|BD|business days?)(?![A-Za-zÀ-ÿ])/i);
  return match ? Number(match[1].replace(',', '.')) : undefined;
}
