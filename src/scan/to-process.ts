/**
 * Du tableau photographié au process : une ligne par étape, reliées dans
 * l'ordre du tableau ou par la colonne « Suite ».
 *
 * - Suite : un numéro (« 2 »), plusieurs cas (« oui → 3 ; non → 4 »), ou
 *   « fin ». Vide, l'étape mène à la ligne suivante. Sans colonne Suite, les
 *   étapes se suivent dans l'ordre du tableau.
 * - Rôles : une étape d'où partent plusieurs cas est une décision ; celles où
 *   rien n'arrive sont des départs ; celles d'où rien ne part, des fins.
 * - Délai : « 2 JO », « 3 jours », « 4 h » (sur une journée de 8 h),
 *   « 1 sem. » (5 jours ouvrés) ou un nombre seul, en jours ouvrés.
 *
 * Ce qui manque ou ne se lit pas devient une remarque, à corriger ensuite dans
 * l'éditeur. Fonctions pures, testées dans __tests__/to-process.test.ts.
 */

import type { Link, Process, Step } from '@/domain';
import type { ImportResult } from '@/import';
import { durationOf } from '@/import/text';

import type { ColumnKind, ScannedTable } from './table';

/** Heures dans une journée de travail, pour convertir « 4 h » en jours. */
const HOURS_PER_DAY = 8;
/** Jours ouvrés dans une semaine. */
const DAYS_PER_WEEK = 5;

/** Délai d'une case du tableau, en jours ouvrés ; undefined si la case est vide ou illisible. */
export function delayOf(text: string): number | undefined {
  const value = text.trim();
  const number = (raw: string) => Number(raw.replace(',', '.'));
  const hours = value.match(/^(\d+(?:[.,]\d+)?)\s*(?:h|heures?|hours?)\b/i);
  if (hours) return round(number(hours[1]) / HOURS_PER_DAY);
  const weeks = value.match(/^(\d+(?:[.,]\d+)?)\s*(?:sem(?:aines?)?\.?|weeks?|wk)(?![A-Za-zÀ-ÿ])/i);
  if (weeks) return number(weeks[1]) * DAYS_PER_WEEK;
  const days = durationOf(value);
  if (days !== undefined) return days;
  const alone = value.match(/^(\d+(?:[.,]\d+)?)$/);
  return alone ? number(alone[1]) : undefined;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Une suite lue : vers quelle ligne (son numéro), avec quel cas. */
type Next = { to: string; label?: string };

const END = /^(fin|end|termin[ée]|stop|-|—|–)$/i;

/** Les suites d'une case « Suite » : « 2 », « 3, 4 », « oui → 3 ; non → 4 », « fin ». null si illisible. */
export function nextOf(text: string): Next[] | 'end' | null {
  const value = text.trim();
  if (!value) return [];
  if (END.test(value)) return 'end';
  const parts = value.split(/\s*[;,/]\s*|\s+(?=\S+\s*(?:→|->|=>|»|:)\s*\d)/).filter(Boolean);
  const result: Next[] = [];
  for (const part of parts) {
    const match = part.match(/^(?:(.*?)\s*(?:→|->|=>|»|:|\s)\s*)?(\d+)$/);
    if (!match) return null;
    const label = match[1]?.trim();
    result.push(label ? { to: match[2], label } : { to: match[2] });
  }
  return result;
}

/** Le process lu dans un tableau. `idPrefix` rend les identifiants uniques. */
export function tableToProcess(table: ScannedTable, name: string, idPrefix: string): ImportResult {
  const warnings: string[] = [];
  const column = (kind: ColumnKind) => table.columns.findIndex((item) => item.kind === kind);
  const [numberCol, stepCol, actorCol, delayCol, nextCol] = (
    ['number', 'step', 'actor', 'delay', 'next'] as ColumnKind[]
  ).map(column);
  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');

  // Une étape par ligne qui a un intitulé ; le numéro sert aux suites.
  const rows = table.rows
    .map((row, index) => ({
      row,
      line: index + 1,
      number: cell(row, numberCol).replace(/\D/g, '') || String(index + 1),
    }))
    .filter(({ row, line }) => {
      if (cell(row, stepCol)) return true;
      warnings.push(`Ligne ${line} : pas d’intitulé d’étape, ligne ignorée.`);
      return false;
    });
  const idOf = new Map(rows.map(({ number }) => [number, `${idPrefix}-s${number}`]));

  const steps: Step[] = rows.map(({ row, line, number }) => {
    const step: Step = { id: idOf.get(number)!, kind: 'task', title: cell(row, stepCol) };
    const actor = cell(row, actorCol);
    if (actor) step.actor = actor;
    else if (actorCol >= 0) warnings.push(`Étape ${number} : pas d’acteur, à compléter dans l’éditeur.`);
    const delayText = cell(row, delayCol);
    const delay = delayText ? delayOf(delayText) : undefined;
    if (delay !== undefined) step.duration = delay;
    else if (delayText && !END.test(delayText)) warnings.push(`Ligne ${line} : délai « ${delayText} » non compris.`);
    return step;
  });

  const links: Link[] = [];
  rows.forEach(({ row, number }, index) => {
    const from = idOf.get(number)!;
    const following = rows[index + 1];
    const read = nextCol >= 0 ? nextOf(cell(row, nextCol)) : [];
    if (read === 'end') return;
    let nexts: Next[] = read ?? [];
    if (read === null) warnings.push(`Étape ${number} : suite « ${cell(row, nextCol)} » non comprise.`);
    // Case vide (ou sans colonne Suite) : la ligne suivante.
    if (read !== null && nexts.length === 0 && following) nexts = [{ to: following.number }];
    for (const next of nexts) {
      const to = idOf.get(next.to);
      if (!to) {
        warnings.push(`Étape ${number} : la suite ${next.to} n’existe pas dans le tableau.`);
        continue;
      }
      links.push({ id: `${idPrefix}-l${links.length + 1}`, from, to, ...(next.label ? { label: next.label } : {}) });
    }
  });

  // Rôles, d'après les liens.
  for (const step of steps) {
    const outs = links.filter((link) => link.from === step.id).length;
    const ins = links.filter((link) => link.to === step.id).length;
    if (outs >= 2) step.kind = 'decision';
    else if (ins === 0 && outs > 0) step.kind = 'start';
    else if (outs === 0) step.kind = 'end';
  }
  if (steps.length > 0 && !steps.some((step) => step.kind === 'start')) {
    if (steps[0].kind === 'task') steps[0].kind = 'start';
  }

  const process: Process = { id: `${idPrefix}-1`, name, source: 'scan', steps, links };
  return { processes: [process], warnings };
}
