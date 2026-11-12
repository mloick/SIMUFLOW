/**
 * Remplir un formulaire lu dans un template : quelles questions s'affichent
 * selon les réponses déjà données, quelles réponses manquent ou sont mal
 * écrites, et le récapitulatif de la demande. Logique pure, sans écran.
 */

import { isQuestionVisible, type FormQuestion } from './formulaire';

/** Réponse à une question : un texte, des choix cochés (ou des fichiers joints), ou un texte par champ d'un libellé. */
export type FormAnswer = string | string[] | Record<string, string>;

/** Réponses par numéro de question. */
export type FormAnswers = Record<number, FormAnswer>;

/** Types qui n'attendent pas de réponse : titres, séparateurs. */
const NO_ANSWER: FormQuestion['type'][] = ['container', 'break'];

/** Types remplis par l'outil réel (liste de ses données) : on ne peut pas y répondre ici. */
const TOOL_FILLED: FormQuestion['type'][] = ['list', 'reference'];

/** La question attend-elle une réponse de la personne qui remplit ? */
export function expectsAnswer(question: FormQuestion): boolean {
  if (NO_ANSWER.includes(question.type) || TOOL_FILLED.includes(question.type)) return false;
  if (question.type === 'label' || question.type === 'richlabel') return question.fields.length > 0;
  return true;
}

/**
 * Les questions affichées, dans l'ordre. Une réponse donnée à une question
 * cachée ne compte pas : « Si OUI » sous une question elle-même cachée reste
 * caché, même si une ancienne réponse disait oui.
 */
export function visibleQuestions(questions: FormQuestion[], answers: FormAnswers): FormQuestion[] {
  const given = new Map<number, string | string[]>();
  const shown: FormQuestion[] = [];
  for (const question of questions) {
    if (!isQuestionVisible(question, given)) continue;
    shown.push(question);
    const answer = answers[question.n];
    if (typeof answer === 'string' || Array.isArray(answer)) given.set(question.n, answer);
  }
  return shown;
}

/** La réponse est-elle vide ? */
export function isEmptyAnswer(question: FormQuestion, answer: FormAnswer | undefined): boolean {
  if (answer === undefined) return true;
  if (typeof answer === 'string') return answer.trim() === '';
  if (Array.isArray(answer)) return answer.length === 0;
  return question.fields.every((field) => !(answer[field] ?? '').trim());
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL = /^https?:\/\/[^\s.]+\.[^\s]+$/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDate(text: string): boolean {
  const match = DATE.exec(text);
  if (!match) return false;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Ce qui ne va pas dans une réponse, ou `null` si elle convient. */
export function answerProblem(question: FormQuestion, answer: FormAnswer | undefined): string | null {
  if (!expectsAnswer(question)) return null;
  if (isEmptyAnswer(question, answer)) {
    if (!question.mandatory) return null;
    if (question.type === 'label' || question.type === 'richlabel') return 'Remplissez tous les champs.';
    if (question.type === 'attachment') return 'Ajoutez au moins un fichier.';
    return 'Réponse obligatoire.';
  }
  if (question.mandatory && (question.type === 'label' || question.type === 'richlabel') && typeof answer === 'object' && !Array.isArray(answer)) {
    if (question.fields.some((field) => !(answer[field] ?? '').trim())) return 'Remplissez tous les champs.';
  }
  if (typeof answer !== 'string') return null;
  const text = answer.trim();
  switch (question.type) {
    case 'email':
      return EMAIL.test(text) ? null : 'Adresse e-mail attendue, par exemple nom@exemple.fr.';
    case 'url':
      return URL.test(text) ? null : 'Adresse web attendue, commençant par https://.';
    case 'ip':
      return IPV4.test(text) ? null : 'Adresse IP attendue, par exemple 192.168.1.10.';
    case 'date':
      return isDate(text) ? null : 'Date attendue au format jj/mm/aaaa.';
    case 'datetime': {
      const [day, time] = text.split(/\s+/);
      return isDate(day ?? '') && TIME.test(time ?? '') ? null : 'Date et heure attendues au format jj/mm/aaaa hh:mm.';
    }
    default:
      return null;
  }
}

/** Les problèmes des questions affichées, par numéro de question. Vide : la demande peut partir. */
export function checkAnswers(questions: FormQuestion[], answers: FormAnswers): Map<number, string> {
  const problems = new Map<number, string>();
  for (const question of visibleQuestions(questions, answers)) {
    const problem = answerProblem(question, answers[question.n]);
    if (problem) problems.set(question.n, problem);
  }
  return problems;
}

/** Une ligne du récapitulatif de la demande. */
export interface AnswerLine {
  n: number;
  label: string;
  answer: string;
}

/** Une réponse écrite sur une ligne. */
export function answerText(question: FormQuestion, answer: FormAnswer): string {
  if (typeof answer === 'string') return answer.trim();
  if (Array.isArray(answer)) return answer.join(', ');
  return question.fields
    .map((field) => (answer[field]?.trim() ? `${field} : ${answer[field].trim()}` : null))
    .filter(Boolean)
    .join(' · ');
}

/** Le récapitulatif : les questions affichées et répondues, dans l'ordre. */
export function answerSummary(questions: FormQuestion[], answers: FormAnswers): AnswerLine[] {
  return visibleQuestions(questions, answers)
    .filter((question) => expectsAnswer(question) && !isEmptyAnswer(question, answers[question.n]))
    .map((question) => ({
      n: question.n,
      label: question.label.split('\n')[0],
      answer: answerText(question, answers[question.n]),
    }));
}
