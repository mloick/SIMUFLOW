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

export function anonymizeProcess(process: Process, options: AnonymizeOptions = {}): Anonymizer {
  const actors = [
    ...new Set(process.steps.map((step) => step.actor?.trim()).filter((actor): actor is string => !!actor)),
  ];
  const names = new Map(actors.map((actor, index) => [actor, serviceName(index)]));
  const hidden = (options.hidden ?? []).map((word) => word.trim()).filter((word) => word.length > 1);
  const terms: [string, string][] = [
    ...actors.map((actor): [string, string] => [actor, names.get(actor)!]),
    ...hidden.map((word): [string, string] => [word, MASKED]),
  ].sort((a, b) => b[0].length - a[0].length);

  const text = (value: string) => replaceTerms(maskContacts(value), terms);

  return {
    process: {
      ...process,
      name: text(process.name),
      steps: process.steps.map((step) => {
        const actor = step.actor?.trim();
        return {
          ...step,
          title: text(step.title),
          ...(actor ? { actor: names.get(actor) } : {}),
        };
      }),
      links: process.links.map((link) => (link.label ? { ...link, label: text(link.label) } : link)),
    },
    text,
    actorCount: actors.length,
  };
}

/** « Entreprise X, Client Y » → les mots à masquer, séparés par des virgules ou des retours à la ligne. */
export function parseHiddenWords(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}
