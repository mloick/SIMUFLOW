/**
 * Modifier un formulaire après sa lecture : ce qu'aucune règle de lecture ne
 * peut deviner (une question en trop, un document à ajouter, une condition).
 * Chaque fonction renvoie un nouveau formulaire. Les questions restent
 * numérotées dans l'ordre (1, 2, 3…) : après un ajout, une suppression ou un
 * déplacement, les conditions suivent leur question.
 * Fonctions pures, testées dans __tests__/edition.test.ts.
 */

import type { FormCondition, FormQuestion, FormTemplate, QuestionType } from './formulaire';

/** Les types qu'on peut choisir dans l'éditeur, dans l'ordre affiché. */
export const EDITABLE_TYPES: { type: QuestionType; label: string }[] = [
  { type: 'text', label: 'Texte court' },
  { type: 'multiline', label: 'Texte long' },
  { type: 'label', label: 'Champs à remplir' },
  { type: 'yesno', label: 'Oui / non' },
  { type: 'select', label: 'Menu déroulant' },
  { type: 'checkbox', label: 'Cases à cocher' },
  { type: 'attachment', label: 'Pièce jointe' },
  { type: 'date', label: 'Date' },
  { type: 'email', label: 'E-mail' },
  { type: 'container', label: 'Titre de section' },
];

/** Le nom d'un type, tel que l'éditeur l'affiche. */
export function typeLabel(type: QuestionType): string {
  return EDITABLE_TYPES.find((item) => item.type === type)?.label ?? type;
}

/** Ce que la question liste, selon son type : choix, champs ou documents. */
export function listKind(type: QuestionType): 'options' | 'fields' | 'documents' | null {
  if (type === 'select' || type === 'checkbox' || type === 'scale') return 'options';
  if (type === 'label' || type === 'richlabel') return 'fields';
  if (type === 'attachment') return 'documents';
  return null;
}

/** Les réponses possibles d'une question à choix (pour écrire une condition). */
export function answersOf(question: FormQuestion): string[] {
  if (question.type === 'yesno') return ['Oui', 'Non'];
  return listKind(question.type) === 'options' ? question.options.filter((option) => option.trim()) : [];
}

/** Les questions dont une réponse peut faire apparaître la question `n` : celles d'avant, à choix. */
export function conditionSources(form: FormTemplate, n: number): FormQuestion[] {
  return form.questions.filter((question) => question.n < n && answersOf(question).length > 0);
}

/**
 * Renumérote les questions dans l'ordre donné ; chaque condition suit sa
 * question, et une condition sur une question disparue est retirée.
 */
function renumber(form: FormTemplate, questions: FormQuestion[]): FormTemplate {
  const next = new Map(questions.map((question, index) => [question.n, index + 1]));
  return {
    ...form,
    questions: questions.map((question, index) => ({
      ...question,
      n: index + 1,
      conditions: question.conditions
        .filter((condition) => next.has(condition.question))
        .map((condition) => ({ ...condition, question: next.get(condition.question)! })),
    })),
  };
}

export function updateQuestion(form: FormTemplate, n: number, patch: Partial<Omit<FormQuestion, 'n'>>): FormTemplate {
  return { ...form, questions: form.questions.map((question) => (question.n === n ? { ...question, ...patch } : question)) };
}

/** Change le type ; les choix, champs et documents déjà écrits sont gardés. */
export function changeType(form: FormTemplate, n: number, type: QuestionType): FormTemplate {
  return updateQuestion(form, n, { type, typeText: typeLabel(type) });
}

/** Les questions qui dépendent de la question `n`. */
export function dependants(form: FormTemplate, n: number): FormQuestion[] {
  return form.questions.filter((question) => question.conditions.some((condition) => condition.question === n));
}

/** Supprime une question ; celles qui en dépendaient perdent cette condition. */
export function removeQuestion(form: FormTemplate, n: number): FormTemplate {
  return renumber(
    form,
    form.questions.filter((question) => question.n !== n),
  );
}

/** Monte (-1) ou descend (+1) une question. */
export function moveQuestion(form: FormTemplate, n: number, delta: -1 | 1): FormTemplate {
  const index = form.questions.findIndex((question) => question.n === n);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= form.questions.length) return form;
  const questions = [...form.questions];
  [questions[index], questions[target]] = [questions[target], questions[index]];
  return renumber(form, questions);
}

/**
 * Ajoute une question après la question `after` (au début avec 0) ; elle
 * reprend ses conditions, pour rester dans le même cas. Renvoie aussi son numéro.
 */
export function addQuestion(form: FormTemplate, after: number, type: QuestionType = 'text'): { form: FormTemplate; n: number } {
  const previous = form.questions.find((question) => question.n === after);
  const added: FormQuestion = {
    n: -1,
    label: '',
    type,
    typeText: typeLabel(type),
    mandatory: false,
    explanation: null,
    options: [],
    fields: [],
    documents: [],
    help: null,
    example: null,
    conditions: previous ? previous.conditions.map((condition) => ({ ...condition })) : [],
    conditionText: null,
    cell: '',
  };
  const index = previous ? form.questions.indexOf(previous) + 1 : 0;
  const questions = [...form.questions.slice(0, index), added, ...form.questions.slice(index)];
  return { form: renumber(form, questions), n: index + 1 };
}

export function addCondition(form: FormTemplate, n: number, condition: FormCondition): FormTemplate {
  const question = form.questions.find((item) => item.n === n);
  if (!question || question.conditions.some((item) => item.question === condition.question && item.equals === condition.equals)) return form;
  return updateQuestion(form, n, { conditions: [...question.conditions, condition] });
}

export function removeCondition(form: FormTemplate, n: number, index: number): FormTemplate {
  const question = form.questions.find((item) => item.n === n);
  if (!question) return form;
  return updateQuestion(form, n, { conditions: question.conditions.filter((_, position) => position !== index) });
}

/** Avant d'enregistrer : retire les lignes vides des listes et les espaces autour des intitulés. */
export function cleanForm(form: FormTemplate): FormTemplate {
  const clean = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
  return {
    ...form,
    questions: form.questions.map((question) => ({
      ...question,
      label: question.label.trim() || 'Question sans titre',
      options: clean(question.options),
      fields: clean(question.fields),
      documents: clean(question.documents),
      help: question.help?.trim() || null,
    })),
  };
}
