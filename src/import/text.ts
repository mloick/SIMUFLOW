/**
 * Texte lisible à partir du libellé d'une forme draw.io, qui peut contenir du
 * HTML (« <b>Valider</b><br>2 JO »). Pas de DOM dans l'app : on traite les
 * balises et les entités à la main.
 */
export function cellText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>|<\/?div[^>]*>|<\/?p[^>]*>|<\/li>/gi, '\n')
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

/** Délai écrit dans le texte d'une étape : « 2 JO », « 1,5 jour ouvré », « 3 BD », « 5 jours », « 2 j ». */
export function durationOf(text: string): number | undefined {
  const match = text.match(
    /(\d+(?:[.,]\d+)?)\s*(JO|jours? ouvr[ée]s?|BD|business days?|jours?|days?|j)(?![A-Za-zÀ-ÿ])/i,
  );
  return match ? Number(match[1].replace(',', '.')) : undefined;
}

/** Libellés qui annoncent un acteur dans le texte d'une étape (« Responsable : … »). */
const ACTOR_LABEL =
  /^(?:acteur|actor|responsable|owner|qui|r[ôo]le|[ée]quipe|team|assign(?:ee|[ée]e?)(?: à)?|assign(?:e)?ment group|assigned to|groupe(?: d[’']affectation| de r[ée]solution)?)\s*:\s*(.*)$/i;

const ORGANISATION = /service|[ée]quipe|groupe|team|direction|d[ée]partement|p[ôo]le|cellule/i;

/**
 * Acteur annoncé dans le texte d'une étape : « Responsable : Équipe Achats »,
 * « Assignee : Camille (service Achats) ». La valeur peut être sur la ligne
 * suivante. Un process décrit des rôles, pas des personnes : entre un nom et
 * un service entre parenthèses, on garde le service, et des noms entre
 * parenthèses après un service sont retirés.
 */
export function actorFromText(text: string): string | undefined {
  const lines = text.split('\n').map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ACTOR_LABEL);
    if (!match) continue;
    const value = match[1].trim() || lines.slice(i + 1).find((line) => line && !ACTOR_LABEL.test(line)) || '';
    const actor = cleanActor(value);
    if (actor) return actor;
  }
  return undefined;
}

function cleanActor(value: string): string | undefined {
  let actor = value;
  const parts = value.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (parts) actor = ORGANISATION.test(parts[2]) && !ORGANISATION.test(parts[1]) ? parts[2] : parts[1];
  actor = actor.replace(/[\s.;:,–-]+$/, '').trim();
  return actor ? actor[0].toUpperCase() + actor.slice(1) : undefined;
}
