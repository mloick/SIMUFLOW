/**
 * Modèle « template de formulaire » : le classeur qui décrit un formulaire de
 * demande avant sa création dans l'outil de tickets. Onglets lus :
 *
 * - « Basic info » : nom, description, type de ticket, mots clés ;
 * - « Questions » : une colonne par question (« Question 1 », « Question 2 »…)
 *   et une ligne par propriété (nom, format, obligatoire, explication,
 *   conditions, aide, exemple), ou l'inverse (une ligne par question) ;
 * - « Fulfillment flow » : les tasks (titre, groupe, séquence) ;
 * - « Assignment & Summary » : groupe propriétaire et résumé du ticket.
 *
 * Chaque question reçoit son type (texte, oui / non, cases à cocher, menu
 * déroulant, pièce jointe, date…), ses choix, ses champs à remplir, ses
 * documents attendus et ses conditions d'affichage. Les conditions sont lues
 * dans la ligne prévue (« Si Question 2 = Cas 3 »), ou dans l'intitulé, où
 * elles sont souvent écrites : « Si NON : … » suit la question oui / non
 * précédente, « MOTIF 1 : … » le choix « MOTIF 1 » d'une question précédente.
 * Fonctions pures, testées dans __tests__/formulaire.test.ts.
 */

import { bareSheetName } from '../detect';
import { filledRows } from '../grid';
import type { Sheet, Workbook } from '../types';

import { columnLetter, type SituationWarning } from './sla-ola';

export type QuestionType =
  | 'text'
  | 'multiline'
  | 'yesno'
  | 'select'
  | 'checkbox'
  | 'list'
  | 'scale'
  | 'reference'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'ip'
  | 'attachment'
  | 'label'
  | 'richlabel'
  | 'container'
  | 'break';

/** La question s'affiche quand la question `question` (son numéro) a la réponse `equals`. */
export type FormCondition = { question: number; equals: string };

export type FormQuestion = {
  /** Numéro de la question, à partir de 1. */
  n: number;
  /** Intitulé tel qu'écrit, préfixes de condition compris (« Si NON : … »). */
  label: string;
  type: QuestionType;
  /** Format tel qu'écrit dans le template. */
  typeText: string;
  mandatory: boolean;
  /** Explication complète, telle qu'écrite. */
  explanation: string | null;
  /** Choix d'un menu déroulant, de cases à cocher ou d'une échelle. */
  options: string[];
  /** Champs à remplir annoncés dans l'explication (« Nom : », « Téléphone : »). */
  fields: string[];
  /** Documents attendus pour une pièce jointe. */
  documents: string[];
  /** Aide affichée sous la question. */
  help: string | null;
  /** Exemple de réponse, qui disparaît quand on écrit. */
  example: string | null;
  /** Toutes doivent être vraies pour afficher la question. */
  conditions: FormCondition[];
  /** Texte de la ligne « Conditions », s'il y en a un. */
  conditionText: string | null;
  /** Cellule de l'intitulé, comme dans Excel. */
  cell: string;
};

export type FormTask = { n: number; description: string | null; group: string | null; sequence: string | null };

export type FormWarning = SituationWarning & { sheet: string };

export type FormTemplate = {
  name: string | null;
  description: string | null;
  ticketType: string | null;
  keywords: string[];
  questions: FormQuestion[];
  tasks: FormTask[];
  /** Groupe propriétaire du ticket. */
  assignmentGroup: string | null;
  /** Résumé du ticket créé, avec ses {réponses}. */
  summary: string | null;
  warnings: FormWarning[];
};

// ---------------------------------------------------------------------------
// Textes

const norm = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const BULLET = /^[-•*–·]\s*/;

/** Type d'une question d'après son format, en français ou en anglais. */
export function questionType(text: string): QuestionType | null {
  const plain = norm(text);
  if (!plain) return null;
  const tests: [RegExp, QuestionType][] = [
    [/piece jointe|attachment/, 'attachment'],
    [/^pause|^break/, 'break'],
    [/contenant|container|division|^debut|^fin\b/, 'container'],
    [/case a cocher|checkbox/, 'checkbox'],
    [/date et heure|date\s*\/\s*time|date time/, 'datetime'],
    [/^date/, 'date'],
    [/e-?mail/, 'email'],
    [/adresse ip|ip address/, 'ip'],
    [/rtf|rich text/, 'richlabel'],
    [/menu deroulant|liste deroulante|select box|drop.?down/, 'select'],
    [/^libelle|^label/, 'label'],
    [/^listes?\b|list collector/, 'list'],
    [/plusieurs lignes|multi.?line/, 'multiline'],
    [/echelle|scale/, 'scale'],
    [/^reference/, 'reference'],
    [/une ligne|single.?line|^texte|^text/, 'text'],
    [/^url/, 'url'],
    [/oui\s*\/\s*non|yes\s*\/\s*no/, 'yesno'],
  ];
  return tests.find(([pattern]) => pattern.test(plain))?.[1] ?? null;
}

/** Libellés des types, pour l'écran. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Texte sur une ligne',
  multiline: 'Texte sur plusieurs lignes',
  yesno: 'Oui / Non',
  select: 'Menu déroulant',
  checkbox: 'Cases à cocher',
  list: 'Liste',
  scale: 'Échelle',
  reference: 'Référence',
  date: 'Date',
  datetime: 'Date et heure',
  email: 'Email',
  url: 'Lien',
  ip: 'Adresse IP',
  attachment: 'Pièce jointe',
  label: 'Libellé',
  richlabel: 'Texte mis en forme',
  container: 'Section',
  break: 'Séparateur',
};

// ---------------------------------------------------------------------------
// Fiches : une colonne (ou une ligne) par élément, une ligne (ou colonne) par propriété

type ItemRecord<K extends string> = { values: Partial<{ [key in K]: string }>; cell: string };

/** Clé de la propriété nommée par un intitulé de ligne (ou de colonne), d'après des motifs dans l'ordre. */
const propertyOf = <K extends string>(label: string, patterns: [K, RegExp][]): K | null =>
  patterns.find(([, pattern]) => pattern.test(norm(label)))?.[0] ?? null;

/**
 * Lit les éléments d'un onglet (questions, tasks). Si une ligne porte des
 * titres « Question 1 », « Task 2 »…, chaque colonne ainsi titrée est un
 * élément et la première colonne nomme les propriétés. Sinon, la première
 * ligne qui nomme au moins deux propriétés est l'en-tête, et chaque ligne
 * suivante est un élément. `nameKey` : la propriété sans laquelle un élément
 * n'existe pas.
 */
function readRecords<K extends string>(sheet: Sheet, item: RegExp, patterns: [K, RegExp][], nameKey: K): ItemRecord<K>[] {
  const rows = filledRows(sheet);
  const headerIndex = rows.findIndex((row) => row.some((cell) => item.test(norm(cell))));
  const records: ItemRecord<K>[] = [];
  if (headerIndex >= 0) {
    const properties = rows.map((row, index) => (index > headerIndex ? propertyOf(row[0] ?? '', patterns) : null));
    // Les colonnes titrées, et celles d'après remplies sans titre (« Question 15 » oublié).
    const first = rows[headerIndex].findIndex((cell) => item.test(norm(cell)));
    const width = Math.max(...rows.map((row) => row.length));
    const columns = Array.from({ length: width - first }, (_, offset) => first + offset).filter(
      (column) =>
        item.test(norm(rows[headerIndex][column] ?? '')) ||
        rows.some((row, index) => properties[index] !== null && (row[column] ?? '').trim()),
    );
    for (const column of columns) {
      const record: ItemRecord<K> = { values: {}, cell: '' };
      rows.forEach((row, index) => {
        const key = properties[index];
        const value = (row[column] ?? '').trim();
        if (!key || !value || record.values[key] !== undefined) return;
        record.values[key] = value;
        if (key === nameKey) record.cell = `${columnLetter(column)}${index + 1}`;
      });
      if (Object.keys(record.values).length > 0) records.push(record);
    }
    return records;
  }
  const header = rows.findIndex((row) => row.filter((cell) => propertyOf(cell, patterns)).length >= 2);
  if (header < 0) return records;
  const keys = rows[header].map((cell) => propertyOf(cell, patterns));
  rows.slice(header + 1).forEach((row, index) => {
    const record: ItemRecord<K> = { values: {}, cell: '' };
    keys.forEach((key, column) => {
      const value = (row[column] ?? '').trim();
      if (!key || !value || record.values[key] !== undefined) return;
      record.values[key] = value;
      if (key === nameKey) record.cell = `${columnLetter(column)}${header + index + 2}`;
    });
    if (Object.keys(record.values).length > 0) records.push(record);
  });
  return records;
}

/**
 * Valeurs d'un onglet « libellé → valeur » (Basic info, Assignment). La valeur
 * est dans la colonne « Your Value » (ou « Valeur ») quand elle existe ;
 * sinon, sur une ligne de deux cases, la seconde.
 */
function readValues<K extends string>(sheet: Sheet, patterns: [K, RegExp][]): Partial<{ [key in K]: string }> {
  const rows = filledRows(sheet);
  let valueColumn = -1;
  const values: Partial<{ [key in K]: string }> = {};
  for (const row of rows) {
    const header = row.findIndex((cell) => /^(your value|valeurs?|value)$/.test(norm(cell)));
    if (header > 0) {
      valueColumn = header;
      continue;
    }
    const key = propertyOf(row[0] ?? '', patterns);
    if (!key || values[key] !== undefined) continue;
    const filled = row.filter((cell) => cell.trim());
    const value = valueColumn > 0 ? (row[valueColumn] ?? '') : filled.length === 2 ? filled[1] : '';
    if (value.trim()) values[key] = value.trim();
  }
  return values;
}

// ---------------------------------------------------------------------------
// Questions

const QUESTION_PROPERTIES: ['help' | 'example' | 'conditions' | 'mandatory' | 'explanation' | 'type' | 'name', RegExp][] = [
  ['help', /italique|\baide\b|\bhelp\b/],
  ['example', /exemple|example/],
  ['conditions', /condition|dependance|dependence/],
  ['mandatory', /oblig|mandatory|required/],
  ['explanation', /explication|\boptions?\b|valeurs|choix/],
  ['type', /format|^type/],
  ['name', /question|^nom\b|^name|intitule/],
];

const isYes = (text: string) => /^(oui|yes|x|vrai|true|obligatoire)\b/.test(norm(text));

/** Choix, champs et documents tirés de l'explication, selon le type. */
function readExplanation(type: QuestionType, explanation: string) {
  const all = lines(explanation);
  const bullets = all.filter((line) => BULLET.test(line)).map((line) => line.replace(BULLET, '').trim());
  // « Nom : », « Téléphone du contact : » : un champ à remplir.
  const fields = all
    .map((line) => line.replace(BULLET, '').trim())
    .filter((line) => /^[^:]{1,80}:\s*\**\s*$/.test(line))
    .map((line) => line.replace(/\s*:\s*\**\s*$/, '').trim());
  if (type === 'select' || type === 'checkbox' || type === 'scale' || type === 'list') {
    if (bullets.length > 0) return { options: bullets, fields: [], documents: [] };
    // Choix écrits sur une ligne : « Cas 1, Cas 2, Cas 3 ».
    if (type !== 'list' && all.length === 1 && /[,;]/.test(all[0])) {
      return { options: all[0].split(/[,;]/).map((item) => item.trim()).filter(Boolean), fields: [], documents: [] };
    }
    return { options: [], fields: [], documents: [] };
  }
  if (type === 'attachment') return { options: [], fields: [], documents: bullets };
  return { options: [], fields, documents: [] };
}

/** « Si Question 2 = Cas 3 », « Afficher si question 5 est Oui ». */
function explicitConditions(text: string): FormCondition[] | null {
  const parts = text.split(/\s+(?:et|and)\s+|\n|;/i).map((part) => part.trim()).filter(Boolean);
  const conditions: FormCondition[] = [];
  for (const part of parts) {
    const match = /question\s*(\d+)\s*(?:=|:|est|vaut|is)\s*«?\s*([^»]+?)\s*»?\.?$/i.exec(part);
    if (!match) return null;
    conditions.push({ question: Number(match[1]), equals: match[2].trim() });
  }
  return conditions.length > 0 ? conditions : null;
}

const optionKey = (text: string) => norm(text).replace(/\s*:.*$/, '');

/**
 * Conditions écrites dans l'intitulé : « Si OUI : » et « X = NON » suivent la
 * question oui / non précédente ; « MOTIF 2 : » suit le choix « MOTIF 2 » d'une
 * question précédente. `undefined` : un préfixe a été vu mais rien ne lui répond.
 */
function labelConditions(label: string, before: FormQuestion[]): FormCondition[] | undefined {
  const conditions: FormCondition[] = [];
  const plain = norm(label);
  const lastYesNo = [...before].reverse().find((question) => question.type === 'yesno');
  const yesNo = /^si (oui|non)\b/.exec(plain) ?? /=\s*(oui|non)\b/.exec(plain);
  if (yesNo) {
    if (!lastYesNo) return undefined;
    conditions.push({ question: lastYesNo.n, equals: yesNo[1] === 'oui' ? 'Oui' : 'Non' });
  }
  const motif = /^motif\s*(\d+)\b/.exec(plain);
  if (motif) {
    const key = `motif ${motif[1]}`;
    const source = [...before]
      .reverse()
      .find((question) => question.options.some((option) => optionKey(option) === key));
    if (!source) return undefined;
    const option = source.options.find((item) => optionKey(item) === key) ?? key;
    conditions.unshift({ question: source.n, equals: option });
  }
  return conditions;
}

function readQuestions(sheet: Sheet, warnings: FormWarning[]): FormQuestion[] {
  const records = readRecords(sheet, /^questions? ?\d+$/, QUESTION_PROPERTIES, 'name');
  const questions: FormQuestion[] = [];
  const warn = (level: FormWarning['level'], message: string, cell: string, question?: string) =>
    warnings.push({ sheet: sheet.name, level, message, cell, ...(question ? { question } : {}) });

  for (const record of records) {
    const { name, type: typeText = '', mandatory = '', explanation = '', conditions = '', help, example } = record.values;
    if (!name) {
      warn('orange', 'Question sans intitulé : ignorée.', record.cell);
      continue;
    }
    const n = questions.length + 1;
    let type = questionType(typeText);
    if (!type) {
      if (typeText) warn('orange', `Format « ${typeText} » inconnu : affiché comme un texte.`, record.cell, 'Quel type de champ faut-il ?');
      else warn('info', `Question ${n} sans format : affichée comme un libellé.`, record.cell);
      type = typeText ? 'text' : 'label';
    }
    const { options, fields, documents } = readExplanation(type, explanation);
    if (type === 'select' && options.length === 0) {
      warn('orange', `Menu déroulant « ${name.split('\n')[0]} » sans choix.`, record.cell, 'Quels choix le menu propose-t-il ?');
    }
    const question: FormQuestion = {
      n,
      label: name,
      type,
      typeText,
      mandatory: isYes(mandatory),
      explanation: explanation || null,
      options,
      fields,
      documents,
      help: help ?? null,
      example: example ?? null,
      conditions: [],
      conditionText: conditions || null,
      cell: record.cell,
    };
    if (conditions) {
      const parsed = explicitConditions(conditions);
      if (parsed) question.conditions = parsed;
      else warn('orange', `Condition non comprise : « ${conditions} ».`, record.cell, 'Quand cette question doit-elle s’afficher ?');
    }
    if (question.conditions.length === 0) {
      const fromLabel = labelConditions(name, questions);
      if (fromLabel === undefined) {
        warn('orange', `Condition de l’intitulé sans question correspondante : « ${name.split('\n')[0]} ».`, record.cell, 'De quelle réponse dépend cette question ?');
      } else {
        question.conditions = fromLabel;
      }
    }
    questions.push(question);
  }
  return questions;
}

// ---------------------------------------------------------------------------
// Classeur

const TASK_PROPERTIES: ['group' | 'sequence' | 'description', RegExp][] = [
  ['group', /group/],
  ['sequence', /sequence|ordre/],
  ['description', /description|titre|^tasks?$|^tache/],
];

const findSheet = (workbook: Workbook, names: string[]) =>
  workbook.sheets.find((sheet) => names.includes(bareSheetName(sheet.name)));

/**
 * Le formulaire décrit par un template, ou `null` si le classeur n'a pas
 * d'onglet de questions.
 */
export function readFormTemplate(workbook: Workbook): FormTemplate | null {
  const questionsSheet = findSheet(workbook, ['questions', 'variables']);
  if (!questionsSheet) return null;
  const warnings: FormWarning[] = [];

  const basicSheet = findSheet(workbook, ['basic info', 'basic information']);
  const basic = basicSheet
    ? readValues(basicSheet, [
        ['name', /nom du formulaire|^nom\b|item name|^name/],
        ['description', /^description/],
        ['ticket', /^ticket/],
        ['keywords', /mots?.cles?|keyword/],
      ])
    : {};

  const questions = readQuestions(questionsSheet, warnings);
  if (questions.length === 0) {
    warnings.push({
      sheet: questionsSheet.name,
      level: 'orange',
      message: 'Aucune question remplie : le template est encore vide.',
      question: 'Quelles questions le demandeur doit-il remplir ?',
    });
  }

  const flowSheet = findSheet(workbook, ['fulfillment flow', 'fulfilment flow']);
  const tasks: FormTask[] = flowSheet
    ? readRecords(flowSheet, /^(task|tache) ?\d+$/, TASK_PROPERTIES, 'description')
        .filter((record) => record.values.description || record.values.group)
        .map((record, index) => ({
          n: index + 1,
          description: record.values.description ?? null,
          group: record.values.group ?? null,
          sequence: record.values.sequence ?? null,
        }))
    : [];

  const assignmentSheet = findSheet(workbook, ['assignment summary', 'assignment']);
  const assignment = assignmentSheet
    ? readValues(assignmentSheet, [
        ['group', /assignment group|groupe/],
        ['summary', /summary|resume|descriptif/],
      ])
    : {};

  return {
    name: basic.name ?? null,
    description: basic.description ?? null,
    ticketType: basic.ticket ?? null,
    keywords: (basic.keywords ?? '')
      .split(/[,;\n]/)
      .map((word) => word.trim())
      .filter(Boolean),
    questions,
    tasks,
    assignmentGroup: assignment.group ?? null,
    summary: assignment.summary ?? null,
    warnings,
  };
}

/**
 * Faut-il afficher la question, d'après les réponses déjà données ? Une
 * réponse de cases à cocher est la liste des choix cochés.
 */
export function isQuestionVisible(question: FormQuestion, answers: ReadonlyMap<number, string | string[]>): boolean {
  return question.conditions.every(({ question: source, equals }) => {
    const answer = answers.get(source);
    const wanted = optionKey(equals);
    const given = Array.isArray(answer) ? answer : answer ? [answer] : [];
    return given.some((value) => optionKey(value) === wanted || norm(value) === norm(equals));
  });
}
