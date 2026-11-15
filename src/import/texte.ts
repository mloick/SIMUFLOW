/**
 * Process écrit en texte : une ligne par étape, sans IA. Le texte peut être
 * collé, venir d'un fichier .txt ou .md.
 *
 *     Process : Demande de matériel
 *     1. Employé : Faire la demande
 *     2. Responsable : Demande validée ? (2 JO)
 *        oui → 3
 *        non → 5
 *     3. Achats : Passer la commande (1 JO)
 *     4. Logistique : Livrer le matériel (5 JO) → 6
 *     5. Responsable : Prévenir du refus (1 JO) → 6
 *     6. Fin : Demande close
 *
 * - Numéro (« 1. », « 1) », « Étape 1 : ») facultatif : sans numéro, les
 *   lignes sont numérotées dans l'ordre.
 * - Acteur avant « : » (ou « | »), facultatif. « Début : » et « Fin : »
 *   marquent le départ et la fin.
 * - Délai entre parenthèses ou en fin de ligne (« 2 JO », « 3 jours », « 4 h »).
 * - Suite après une flèche (« → 6 », « -> fin », « puis 4 ») ; sans suite,
 *   l'étape mène à la ligne suivante. Sous une question, les lignes
 *   « oui → 3 », « si non : 5 » sont ses cas.
 *
 * Les lignes deviennent un tableau lu comme un tableau scanné
 * (`tableToProcess`) : mêmes règles pour les liens, les décisions, les
 * départs et les fins. Fonctions pures, testées dans __tests__/texte.test.ts.
 */

import { delayOf, tableToProcess } from '@/scan/to-process';

import { ImportError, type ImportResult } from './errors';
import { slaFromText } from './text';

/** Au-delà, ce n'est plus un process écrit à la main. */
const MAX_LINES = 500;

type Row = {
  number: string;
  title: string;
  actor: string;
  delay: string;
  next: string[];
};

const ARROW = /\s*(?:→|->|=>|»)\s*/;
/** « puis 4 », « , aller à fin », « suite : 3 » en fin de ligne (seulement suivis d'un numéro ou de « fin »). */
const WORD_NEXT = /\s*,?\s*(?:puis|aller à|suite\s*:)\s*(\d{1,3}(?:\s*[,;]\s*\d{1,3})*|fin)\s*\.?$/i;
const NUMBER = /^(?:[ée]tape\s*)?(\d{1,3})\s*(?:[.)\-–—:]|\s)\s*/i;
const BULLET = /^[-*•–—]\s+/;
const TITLE = /^(?:#+\s*|(?:process|processus|titre|nom)\s*:\s*)(.+)$/i;
const START_WORDS = /^(d[ée]but|d[ée]part|start)$/i;
const END_WORDS = /^(fin|end)$/i;
/** Cas sous une question : « oui → 3 », « si non : 5 », « - urgent, aller à 4 ». */
const CASE = /^(?:si\s+)?(.{1,40}?)\s*(?:→|->|=>|»|:|,?\s*aller à|,?\s*puis)\s*(\d{1,3}|fin)\s*\.?$/i;

/** Vrai si le texte ressemble à un process écrit (au moins deux lignes utiles). */
export function looksLikeProcessText(text: string): boolean {
  return usefulLines(text).length >= 2 && !/^\s*[<{]/.test(text);
}

function usefulLines(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, ' ').trimEnd())
    .filter((line) => line.trim() && !/^\s*(\/\/|%)/.test(line));
}

/** Lit un process écrit en texte. `name` sert si le texte n'a pas de titre. */
export function parseProcessText(text: string, name: string, idPrefix = 'texte'): ImportResult {
  const lines = usefulLines(text);
  if (lines.length > MAX_LINES) throw new ImportError(`Ce texte est trop long (${MAX_LINES} lignes au plus).`);
  let title: string | undefined;
  const rows: Row[] = [];
  let auto = 0;
  let sla: number | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    // « SLA : 6 JO » sur sa ligne : le délai promis au client, pas une étape.
    const slaLine = /^SLA\b/i.test(line) ? slaFromText(line) : undefined;
    if (slaLine !== undefined) {
      sla = slaLine;
      continue;
    }
    const heading = rows.length === 0 && !title ? line.match(TITLE) : null;
    if (heading) {
      title = heading[1].trim();
      continue;
    }

    // Un cas sous une question : il complète la suite de l'étape précédente.
    const previous = rows[rows.length - 1];
    const bare = line.replace(BULLET, '');
    const caseMatch = previous && !NUMBER.test(bare) ? bare.match(CASE) : null;
    if (
      previous &&
      caseMatch &&
      (/\?\s*$/.test(previous.title) || /^si\s/i.test(bare) || raw.startsWith(' ') || BULLET.test(line)) &&
      caseMatch[1].trim().split(/\s+/).length <= 4
    ) {
      const label = caseMatch[1].trim();
      previous.next.push(/^fin$/i.test(caseMatch[2]) ? 'fin' : `${label} → ${caseMatch[2]}`);
      continue;
    }

    rows.push(readStep(bare, ++auto));
  }

  if (rows.length === 0) throw new ImportError('Aucune étape dans ce texte : écrivez une étape par ligne.');

  // Les numéros écrits remplacent la numérotation automatique s'ils sont tous là et uniques.
  const table = {
    columns: (['number', 'step', 'actor', 'delay', 'next'] as const).map((kind) => ({ kind, label: kind })),
    rows: rows.map((row) => [row.number, row.title, row.actor, row.delay, nextText(row.next)]),
    ignored: 0,
  };
  const numbers = rows.map((row) => row.number);
  if (new Set(numbers).size !== numbers.length) {
    throw new ImportError('Deux étapes portent le même numéro : chaque numéro doit être unique.');
  }

  const result = tableToProcess(table, title || name, idPrefix);
  const process = { ...result.processes[0], source: 'texte' as const, ...(sla !== undefined ? { sla } : {}) };
  // Pas de remarque « pas d'acteur » pour un départ, une fin, ou un texte sans aucun acteur.
  const kinds = new Map(process.steps.map((step) => [step.id.slice(`${idPrefix}-s`.length), step.kind]));
  const warnings = result.warnings
    .filter((warning) => {
      const missing = warning.match(/^Étape (\d+) : pas d’acteur/);
      if (!missing) return true;
      const kind = kinds.get(missing[1]);
      return rows.some((row) => row.actor) && kind !== 'start' && kind !== 'end';
    })
    .map((warning) => warning.replace('dans le tableau', 'dans le texte').replace(/^Ligne (\d+)/, 'Étape $1'));
  return { processes: [process], warnings };
}

function readStep(text: string, auto: number): Row {
  let rest = text;
  let number = String(auto);
  const numbered = rest.match(NUMBER);
  if (numbered && rest.slice(numbered[0].length).trim()) {
    number = numbered[1];
    rest = rest.slice(numbered[0].length);
  }

  // Suite : ce qui suit la première flèche.
  const next: string[] = [];
  const arrow = rest.search(ARROW);
  if (arrow > 0) {
    const target = rest.slice(arrow).replace(ARROW, '').trim().replace(/\.$/, '');
    rest = rest.slice(0, arrow);
    if (target) next.push(target);
  } else {
    const word = rest.match(WORD_NEXT);
    if (word) {
      next.push(word[1]);
      rest = rest.slice(0, word.index);
    }
  }

  // Délai : entre parenthèses, ou après une virgule ou un tiret en fin de ligne.
  let delay = '';
  const inParens = rest.match(/\s*\(([^()]*)\)\s*$/);
  if (inParens && delayOf(inParens[1]) !== undefined) {
    delay = inParens[1].trim();
    rest = rest.slice(0, inParens.index);
  } else {
    const trailing = rest.match(
      /\s*[,–—-]\s*(\d+(?:[.,]\d+)?\s*(?:JO|jours?(?: ouvr[ée]s?)?|j|h|heures?|sem(?:aines?)?\.?))\s*$/i,
    );
    if (trailing) {
      delay = trailing[1];
      rest = rest.slice(0, trailing.index);
    }
  }

  // Acteur : avant « : » ou « | », s'il est court.
  let actor = '';
  const split = rest.match(/^([^:|]{1,40}?)\s*[:|]\s+(.+)$/);
  if (split && split[1].trim().split(/\s+/).length <= 5) {
    actor = split[1].trim();
    rest = split[2];
  }
  if (START_WORDS.test(actor)) actor = '';
  if (END_WORDS.test(actor)) {
    actor = '';
    if (next.length === 0) next.push('fin');
  }

  return {
    number,
    title: rest.trim().replace(/[.;]$/, ''),
    actor,
    delay,
    next,
  };
}

/** Les suites d'une étape au format de la colonne « Suite » du scanner. */
function nextText(next: string[]): string {
  if (next.includes('fin') && next.length === 1) return 'fin';
  return next.filter((item) => item !== 'fin').join(' ; ');
}
