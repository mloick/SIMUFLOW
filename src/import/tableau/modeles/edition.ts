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
      ...(question.partOf !== undefined && next.has(question.partOf) ? { partOf: next.get(question.partOf) } : { partOf: undefined }),
    })).map(({ partOf, ...question }) => (partOf === undefined ? question : { ...question, partOf })),
  };
}

/** La question et ses compléments, qui la suivent. */
function blockOf(questions: FormQuestion[], n: number): FormQuestion[] {
  const root = questions.find((question) => question.n === n);
  if (!root) return [];
  const parent = root.partOf ?? root.n;
  return questions.filter((question) => question.n === parent || question.partOf === parent);
}

/**
 * Les compléments qu'on peut ajouter à une question : seulement des types qui
 * vont avec le sien. Une pièce jointe se décrit par un texte court ; une
 * réponse écrite ou un choix se justifie par une pièce jointe ; un choix se
 * précise par un texte court. Jamais deux façons de répondre à la même chose
 * (oui / non avec un menu déroulant, par exemple).
 */
export function complementTypes(question: FormQuestion): { type: 'text' | 'attachment'; label: string }[] {
  if (question.partOf !== undefined) return [];
  const types: { type: 'text' | 'attachment'; label: string }[] = [];
  if (['attachment', 'yesno', 'select', 'checkbox'].includes(question.type)) {
    types.push({ type: 'text', label: question.type === 'attachment' ? 'Une description du fichier' : 'Une précision écrite' });
  }
  if (['text', 'multiline', 'label', 'yesno', 'select', 'checkbox', 'date', 'email'].includes(question.type)) {
    types.push({ type: 'attachment', label: 'Une pièce jointe' });
  }
  return types;
}

/** Les compléments de la question `n`, dans l'ordre. */
export function complementsOf(form: FormTemplate, n: number): FormQuestion[] {
  return form.questions.filter((question) => question.partOf === n);
}

/**
 * Ajoute un complément à la question `n`, après ses compléments déjà là. Avec
 * `option`, il ne s'affiche que si ce choix est fait (« Autre » → précisez),
 * et il est obligatoire. Renvoie aussi son numéro.
 */
export function addComplement(
  form: FormTemplate,
  n: number,
  type: 'text' | 'attachment',
  option?: string,
): { form: FormTemplate; n: number } {
  const parent = form.questions.find((question) => question.n === n);
  if (!parent || parent.partOf !== undefined) return { form, n };
  const last = complementsOf(form, n).at(-1)?.n ?? n;
  const added = addQuestion(form, last, type);
  const label =
    type === 'attachment'
      ? option
        ? `Pièce jointe (${option})`
        : 'Pièce jointe'
      : parent.type === 'attachment'
        ? 'Description du fichier'
        : option
          ? `Précisez « ${option} »`
          : 'Précision';
  const next = updateQuestion(added.form, added.n, {
    label,
    partOf: n,
    mandatory: option !== undefined,
    conditions: [...parent.conditions.map((condition) => ({ ...condition })), ...(option ? [{ question: n, equals: option }] : [])],
  });
  return { form: next, n: added.n };
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

/** Supprime une question et ses compléments ; celles qui en dépendaient perdent cette condition. */
export function removeQuestion(form: FormTemplate, n: number): FormTemplate {
  return renumber(
    form,
    form.questions.filter((question) => question.n !== n && question.partOf !== n),
  );
}

/**
 * Monte (-1) ou descend (+1) une question, avec ses compléments, au-dessus ou
 * au-dessous de la question voisine et des siens. Un complément reste sous sa
 * question : il ne se déplace pas seul.
 */
export function moveQuestion(form: FormTemplate, n: number, delta: -1 | 1): FormTemplate {
  return moveBlock(form, n, delta).form;
}

/** Comme `moveQuestion`, et donne le nouveau numéro de la question déplacée. */
export function moveBlock(form: FormTemplate, n: number, delta: -1 | 1): { form: FormTemplate; n: number } {
  const block = blockOf(form.questions, n);
  if (block.length === 0 || block[0].n !== n) return { form, n };
  const first = form.questions.indexOf(block[0]);
  const end = first + block.length;
  const neighbour = delta < 0 ? form.questions[first - 1] : form.questions[end];
  if (!neighbour) return { form, n };
  const other = blockOf(form.questions, neighbour.n);
  const rest = form.questions.filter((question) => !block.includes(question) && !other.includes(question));
  const at = form.questions.indexOf(delta < 0 ? other[0] : block[0]);
  const pair = delta < 0 ? [...block, ...other] : [...other, ...block];
  const questions = [...rest.slice(0, at), ...pair, ...rest.slice(at)];
  return { form: renumber(form, questions), n: questions.indexOf(block[0]) + 1 };
}

/**
 * Ajoute une question après la question `after` (au début avec 0) ; elle
 * reprend ses conditions, pour rester dans le même cas. Renvoie aussi son numéro.
 */
export function addQuestion(form: FormTemplate, after: number, type: QuestionType = 'text'): { form: FormTemplate; n: number } {
  // Après une question, la nouvelle passe après ses compléments et reprend les conditions de la question.
  const block = blockOf(form.questions, after);
  const previous = block[0];
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
  const last = block.at(-1);
  const index = last ? form.questions.indexOf(last) + 1 : 0;
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

/**
 * Une pièce jointe qui liste plusieurs documents devient un titre de section suivi d'une
 * pièce jointe par document (mêmes conditions, même obligation).
 */
export function splitDocuments(form: FormTemplate, n: number): FormTemplate {
  const question = form.questions.find((item) => item.n === n);
  const documents = question?.documents.map((document) => document.trim()).filter(Boolean) ?? [];
  if (!question || question.type !== 'attachment' || documents.length < 2) return form;
  let next = updateQuestion(form, n, { type: 'container', typeText: typeLabel('container'), documents: [], fields: [] });
  let after = n;
  for (const document of documents) {
    const added = addQuestion(next, after, 'attachment');
    next = updateQuestion(added.form, added.n, { label: document, mandatory: question.mandatory });
    after = added.n;
  }
  return next;
}
