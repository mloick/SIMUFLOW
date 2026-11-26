/**
 * Découpe un texte en morceaux : du texte simple et des liens (https://…,
 * http://…, www.…), pour pouvoir rendre les liens touchables. La ponctuation
 * qui suit un lien (point, virgule, parenthèse fermante…) n'en fait pas partie.
 * Fonction pure, testée dans __tests__/links.test.ts.
 */

export type TextPart = { text: string; url?: string };

const LINK = /(?:https?:\/\/|www\.)[^\s<>«»"]+/gi;
const TRAILING = /[.,;:!?)\]'’]+$/;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const raw = match[0];
    const link = raw.replace(TRAILING, '');
    const start = match.index ?? 0;
    if (!link || /^www\.?$/i.test(link)) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: link, url: /^www\./i.test(link) ? `https://${link}` : link });
    last = start + link.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
