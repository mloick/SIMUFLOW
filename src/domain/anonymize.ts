/**
 * Anonymisation d'un process, pour le montrer ou le partager sans risque.
 * Les acteurs deviennent « Service A », « Service B »… partout où leur nom
 * apparaît (titres, branches, nom du process). Les adresses e-mail, les
 * numéros de téléphone, les liens et les mots choisis par l'utilisateur
 * (le nom de l'entreprise, par exemple) sont masqués. La forme du process
 * (étapes, liens, délais, positions) ne change pas.
 */

import type { Process } from './types';

export type AnonymizeOptions = {
  /** Autres mots à masquer, par exemple le nom de l'entreprise ou d'un client. */
  hidden?: string[];
};

export type Anonymizer = {
  /** Le process anonymisé. */
  process: Process;
  /** Applique les mêmes remplacements à un autre texte (le nom tapé à l'import, par exemple). */
  text: (value: string) => string;
  /** Nombre d'acteurs renommés. */
  actorCount: number;
};

export const MASKED = '[masqué]';

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const URL = /\b(?:https?:\/\/|www\.)[^\s)]*[^\s).,;:!?]/gi;
const PHONE = /\+?\d[\d\s.()-]{7,}\d/g;

/** Nom fictif du n-ième acteur : Service A … Service Z, puis Service 27… */
export function serviceName(index: number): string {
  return `Service ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;
}

/** Une lettre sans accent ni majuscule, pour comparer « Équipe » et « equipe ». */
function fold(char: string): string {
  return char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function isWordChar(char: string | undefined): boolean {
  return !!char && /[\p{L}\p{N}]/u.test(char);
}

/**
 * Remplace chaque terme (mot entier, sans tenir compte des accents ni des
 * majuscules) par son remplaçant. Les termes les plus longs passent d'abord,
 * pour que « Service paie Nord » gagne sur « Service paie ».
 */
function replaceTerms(value: string, terms: [string, string][]): string {
  let result = value;
  for (const [term, replacement] of terms) {
    const target = [...term].map(fold).join('');
    if (!target) continue;
    // Texte replié, et pour chaque caractère replié, sa position dans le texte d'origine.
    const chars = [...result];
    let folded = '';
    const origin: number[] = [];
    chars.forEach((char, index) => {
      for (const piece of fold(char)) {
        folded += piece;
        origin.push(index);
      }
    });
    const pieces: string[] = [];
    let last = 0;
    let from = 0;
    while (from <= folded.length - target.length) {
      const at = folded.indexOf(target, from);
      if (at < 0) break;
      const start = origin[at];
      const end = origin[at + target.length - 1] + 1;
      if (start >= last && !isWordChar(chars[start - 1]) && !isWordChar(chars[end])) {
        // « l’Équipe » devient « le Service A », « d’Équipe » « de Service A ».
        const elided = start - 2 >= last && /^[ldLD][’']$/.test(chars[start - 2] + chars[start - 1]) && !isWordChar(chars[start - 3]);
        const vowel = /^[aeiouyhAEIOUYH]/.test(fold(replacement[0] ?? ''));
        if (elided && !vowel) {
          pieces.push(chars.slice(last, start - 1).join(''));
          pieces[pieces.length - 1] = pieces[pieces.length - 1].slice(0, -1) + chars[start - 2] + 'e ' + replacement;
        } else pieces.push(chars.slice(last, start).join(''), replacement);
        last = end;
      }
      from = at + 1;
    }
    if (pieces.length > 0) result = pieces.join('') + chars.slice(last).join('');
  }
  return result;
}

function maskContacts(value: string): string {
  return value
    .replace(EMAIL, 'adresse masquée')
    .replace(URL, 'lien masqué')
    .replace(PHONE, (match) => ((match.match(/\d/g)?.length ?? 0) >= 9 ? 'numéro masqué' : match));
}

/** Les acteurs distincts, sans blancs autour, dans l'ordre où ils apparaissent. */
export function distinctNames(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value))];
}

/**
 * Le remplacement de texte commun aux process et aux formulaires : chaque
 * acteur devient « Service A »…, chaque mot de `hidden` « [masqué] », et les
 * e-mails, téléphones et liens sont masqués.
 */
export function textAnonymizer(actors: string[], hidden: string[] = []): (value: string) => string {
  const names = new Map(actors.map((actor, index) => [actor, serviceName(index)]));
  const words = hidden.map((word) => word.trim()).filter((word) => word.length > 1);
  const terms: [string, string][] = [
    ...actors.map((actor): [string, string] => [actor, names.get(actor)!]),
    ...words.map((word): [string, string] => [word, MASKED]),
  ].sort((a, b) => b[0].length - a[0].length);
  return (value: string) => replaceTerms(maskContacts(value), terms);
}

/** Champs techniques (identifiants, genres, cellules, dates) : jamais réécrits. */
const KEPT_KEYS = new Set(['id', 'kind', 'type', 'variant', 'level', 'from', 'to', 'shape', 'cell', 'savedAt', 'updatedAt', 'editedAt']);

/**
 * Applique `text` à chaque texte d'une donnée (objets et listes compris), clés
 * de `limits` comprises, sauf les champs techniques. Les mêmes textes donnent
 * les mêmes remplacements : un choix de formulaire et le nom de sa situation
 * restent reliés.
 */
export function anonymizeData<T>(value: T, text: (value: string) => string, key?: string): T {
  if (typeof value === 'string') return (key && KEPT_KEYS.has(key) ? value : text(value)) as T;
  if (Array.isArray(value)) return value.map((item) => anonymizeData(item, text)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [
        key === 'limits' ? text(name) : name,
        anonymizeData(item, text, name),
      ]),
    ) as T;
  }
  return value;
}

export function anonymizeProcess(process: Process, options: AnonymizeOptions = {}): Anonymizer {
  const actors = distinctNames(process.steps.map((step) => step.actor));
  const text = textAnonymizer(actors, options.hidden);
  return { process: anonymizeProcessWith(process, text), text, actorCount: actors.length };
}

/** Le process passé par `text`, son origine (draw.io, scan…) gardée telle quelle. */
export function anonymizeProcessWith(process: Process, text: (value: string) => string): Process {
  return { ...anonymizeData(process, text), ...(process.source ? { source: process.source } : {}) };
}

/** « Entreprise X, Client Y » → les mots à masquer, séparés par des virgules ou des retours à la ligne. */
export function parseHiddenWords(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}
