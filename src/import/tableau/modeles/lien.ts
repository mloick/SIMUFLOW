/**
 * Le lien entre un formulaire et son workflow : la question du formulaire dont
 * les choix sont les situations du workflow (« Situation : Cas 1, Cas 2… »),
 * et, une fois le formulaire rempli, la situation que la réponse désigne.
 *
 * Les choix et les situations se comparent sans accents, majuscules ni
 * ponctuation ; « MOTIF 2 : Changement de contact » vaut aussi « MOTIF 2 ».
 * Fonctions pures, testées dans __tests__/lien.test.ts.
 */

import type { FormQuestion, FormTemplate } from './formulaire';
import type { FormAnswers } from './reponses';
import type { Situation } from './sla-ola';

const key = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Le libellé avant « : », pour « MOTIF 2 : … ». */
const head = (text: string) => key(text.split(':')[0] ?? text);

/** Index de la situation dont le libellé correspond à ce choix, ou -1. */
export function situationOfOption(option: string, situations: Situation[]): number {
  const wanted = key(option);
  if (!wanted) return -1;
  const exact = situations.findIndex((situation) => key(situation.label) === wanted);
  if (exact >= 0) return exact;
  // « Cas 3 : Contrat » ↔ « Cas 3 », ou l'inverse.
  return situations.findIndex((situation) => head(situation.label) === head(option));
}

export type FormLink = {
  /** La question dont les choix désignent les situations. */
  question: FormQuestion;
  /** Pour chaque choix de la question, l'index de sa situation, ou -1. */
  matches: number[];
  /** Nombre de choix qui ont une situation. */
  linked: number;
};

/** Types de questions dont la réponse est un choix dans une liste. */
const CHOICE_TYPES: FormQuestion['type'][] = ['select', 'checkbox', 'scale'];

/**
 * La question du formulaire qui choisit la situation : celle dont le plus de
 * choix correspondent à une situation du workflow. `null` si aucune.
 */
export function findFormLink(form: FormTemplate, situations: Situation[]): FormLink | null {
  let best: FormLink | null = null;
  for (const question of form.questions) {
    if (!CHOICE_TYPES.includes(question.type) || question.options.length === 0) continue;
    const matches = question.options.map((option) => situationOfOption(option, situations));
    const linked = matches.filter((index) => index >= 0).length;
    if (linked > 0 && (!best || linked > best.linked)) best = { question, matches, linked };
  }
  return best;
}

export type ChosenSituation =
  | { kind: 'situation'; index: number; option: string }
  | { kind: 'unmatched'; option: string }
  | { kind: 'unanswered' }
  | { kind: 'no-link' };

/** La situation désignée par les réponses : la première réponse de la question de lien qui en a une. */
export function chosenSituation(form: FormTemplate, situations: Situation[], answers: FormAnswers): ChosenSituation {
  const link = findFormLink(form, situations);
  if (!link) return { kind: 'no-link' };
  const answer = answers[link.question.n];
  const given = typeof answer === 'string' ? [answer] : Array.isArray(answer) ? answer : [];
  const options = given.filter((value) => value.trim());
  if (options.length === 0) return { kind: 'unanswered' };
  for (const option of options) {
    const index = situationOfOption(option, situations);
    if (index >= 0) return { kind: 'situation', index, option };
  }
  return { kind: 'unmatched', option: options[0] };
}
