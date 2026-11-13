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
 *
 * Les templates mêlent souvent au formulaire des notes pour l'équipe qui le
 * construira. Règles de lecture, valables pour tout template :
 * - « Nom / Prénom du contact : » devient deux champs, « Nom du contact » et
 *   « Prénom du contact » ;
 * - un rappel « !!! Nbre de caractères maximum… » n'est pas un champ : ses
 *   longueurs s'appliquent aux champs du même nom, et il passe dans les
 *   points à vérifier ;
 * - une pièce jointe qui liste plusieurs documents devient une pièce jointe
 *   par document, obligatoire sauf si le document dit « uniquement », « si »,
 *   « facultatif » ou « optionnel » ;
 * - sous des choix, « Dans le cas de X » suivi de documents ajoute un titre
 *   et une pièce jointe par document, affichés quand le choix X est coché ;
 * - un choix « Autre » ou « (Préciser) » reçoit son complément, affiché quand
 *   il est coché : une précision à écrire, ou, si les autres choix demandent
 *   des documents, une pièce jointe et sa description.
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
  /** Longueur maximale d'un champ, d'après un rappel « Nbre de caractères » du template. */
  limits?: Record<string, number>;
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
  /**
   * Complément de la question `partOf` (son numéro) : une description sous une
   * pièce jointe, une pièce jointe sous un texte, une précision sous un choix…
   * Il s'affiche avec elle, et la suit quand on la déplace ou la supprime.
   */
  partOf?: number;
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

/** Un rappel pour l'équipe, pas une question : « !!!!! Nbre de caractères maximum… ». */
const REMINDER = /^!|nbre de caract|nombre (maximum |minimum |max |min )?de caract/;
/** Fin des choix, début des documents demandés selon le choix. */
const CASES_START = /^(dans le cas|pieces? jointes?|documents?\b)/;
/** Un document qui ne sert que dans certains cas. */
const OPTIONAL_DOCUMENT = /\b(uniquement|seulement|si|facultati\w*|optionnel\w*|le cas echeant)\b/;
/** Un choix « Autre », « Autres » ou « … (Préciser) » : la personne précise sa réponse. */
const OTHER_OPTION = /^autres?\b|\bprecise[rz]\b/;

/** « Nom / Prénom du contact » : deux champs. */
function splitField(field: string): string[] {
  const match = /^(nom|prenom)\s*\/\s*(nom|prenom)\b\s*(.*)$/i.exec(field.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (!match || match[1].toLowerCase() === match[2].toLowerCase()) return [field];
  const rest = field.slice(field.length - match[3].length).trim();
  return ['Nom', 'Prénom'].map((part) => (rest ? `${part} ${rest}` : part));
}

/** « Raison Sociale  40 », « CP 5 » : longueurs maximales lues dans un rappel. */
function readLimits(reminder: string[]): { name: string; max: number }[] {
  return reminder
    .map((line) => /^(.+?)[\s:]+(\d{1,4})\s*(car\w*)?\.?$/i.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ name: match[1].trim(), max: Number(match[2]) }));
}

const limitKey = (text: string) =>
  ` ${norm(text)
    .replace(/n°|\bno\b|\bnumero\b/g, 'n ')
    .replace(/\bcp\b/g, 'code postal')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** La longueur de chaque champ : la plus précise des limites dont le nom est dans celui du champ. */
function fieldLimits(fields: string[], limits: { name: string; max: number }[]): Record<string, number> {
  const found: Record<string, number> = {};
  for (const field of fields) {
    const key = limitKey(field);
    const best = limits
      .map((limit) => ({ ...limit, key: limitKey(limit.name) }))
      .filter((limit) => key.includes(limit.key) || limit.key.includes(key))
      .sort((a, b) => Number(key.includes(b.key)) - Number(key.includes(a.key)) || b.key.length - a.key.length)[0];
    if (best) found[field] = best.max;
  }
  return found;
}

export type CaseDocuments = { name: string; documents: string[] };

/** « Dans le cas de la fusion » puis ses documents (« ou par défaut : » est ignoré : chaque document est demandé). */
function readCases(rest: string[]): CaseDocuments[] {
  const cases: CaseDocuments[] = [];
  for (const line of rest) {
    const start = /^dans le cas\s+(?:de la |de l[’']|du |des |de |d[’'])?(.+?)\s*:?\s*$/i.exec(line);
    if (start) {
      cases.push({ name: start[1].trim(), documents: [] });
    } else if (cases.length > 0) {
      if (BULLET.test(line)) cases[cases.length - 1].documents.push(line.replace(BULLET, '').trim());
    }
  }
  return cases.filter((item) => item.documents.length > 0);
}

/** Choix, champs et documents tirés de l'explication, selon le type. */
function readExplanation(type: QuestionType, explanation: string) {
  const every = lines(explanation);
  const stop = every.findIndex((line) => REMINDER.test(norm(line)));
  const all = stop >= 0 ? every.slice(0, stop) : every;
  const reminder = stop >= 0 ? every.slice(stop) : [];
  const empty = { options: [] as string[], fields: [] as string[], documents: [] as string[], reminder, limits: {} as Record<string, number> };
  const bullets = (from: string[]) => from.filter((line) => BULLET.test(line)).map((line) => line.replace(BULLET, '').trim());
  if (type === 'select' || type === 'checkbox' || type === 'scale' || type === 'list') {
    const end = all.findIndex((line) => CASES_START.test(norm(line)));
    const head = end >= 0 ? all.slice(0, end) : all;
    const rest = end >= 0 ? all.slice(end) : [];
    const cases = readCases(rest);
    const casesRequired = rest.some((line) => /obligatoire/.test(norm(line)));
    const options = bullets(head);
    if (options.length > 0) return { ...empty, options, cases, casesRequired };
    // Choix écrits sur une ligne : « Cas 1, Cas 2, Cas 3 ».
    if (type !== 'list' && head.length === 1 && /[,;]/.test(head[0])) {
      return { ...empty, options: head[0].split(/[,;]/).map((item) => item.trim()).filter(Boolean), cases, casesRequired };
    }
    return empty;
  }
  if (type === 'attachment') return { ...empty, documents: bullets(all) };
  // « Nom : », « Téléphone du contact : » : un champ à remplir.
  const fields = all
    .map((line) => line.replace(BULLET, '').trim())
    .filter((line) => /^[^:]{1,80}:\s*\**\s*$/.test(line))
    .map((line) => line.replace(/\s*:\s*\**\s*$/, '').trim())
    .flatMap(splitField);
  return { ...empty, fields, limits: fieldLimits(fields, readLimits(reminder)) };
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
  const casesOf = new Map<number, { cases: CaseDocuments[]; required: boolean }>();
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
    const read = readExplanation(type, explanation);
    const { options, fields, documents } = read;
    if (read.reminder.length > 0) {
      warn(
        'info',
        `Rappel pour l’équipe, retiré du formulaire : « ${read.reminder.map((line) => line.replace(/\s+/g, ' ')).join(' ; ')} ».${Object.keys(read.limits).length > 0 ? ` Longueurs appliquées : ${Object.entries(read.limits).map(([field, max]) => `${field} ${max}`).join(', ')}.` : ''}`,
        record.cell,
      );
    }
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
      ...(Object.keys(read.limits).length > 0 ? { limits: read.limits } : {}),
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
    if ('cases' in read && read.cases && read.cases.length > 0) casesOf.set(question.n, { cases: read.cases, required: read.casesRequired ?? false });
  }
  return expandDocuments(questions, casesOf, warn);
}

/**
 * Une pièce jointe par document (la question d'origine devient un titre), et
 * les documents de chaque choix après la question à choix. Les questions sont
 * renumérotées, conditions comprises.
 */
function expandDocuments(
  questions: FormQuestion[],
  casesOf: Map<number, { cases: CaseDocuments[]; required: boolean }>,
  warn: (level: FormWarning['level'], message: string, cell: string, question?: string) => void,
): FormQuestion[] {
  const out: { question: FormQuestion; from: number | null }[] = [];
  const attachment = (base: FormQuestion, label: string, mandatory: boolean, documents: string[], conditions: FormCondition[]) => ({
    question: {
      ...base,
      label,
      type: 'attachment' as const,
      mandatory,
      explanation: null,
      options: [],
      fields: [],
      documents,
      help: null,
      example: null,
      conditions,
      conditionText: null,
    },
    from: null,
  });
  for (const question of questions) {
    if (question.type === 'attachment' && question.documents.length > 1) {
      out.push({ question: { ...question, type: 'label', explanation: null, documents: [] }, from: question.n });
      for (const document of question.documents) {
        const optional = OPTIONAL_DOCUMENT.test(norm(document));
        out.push(attachment(question, document, question.mandatory && !optional, [], question.conditions));
      }
      continue;
    }
    out.push({ question, from: question.n });
    const cases = casesOf.get(question.n);
    if (!cases) continue;
    for (const item of cases.cases) {
      const wanted = ` ${norm(item.name).replace(/[^a-z0-9]+/g, ' ').trim()} `;
      const option = question.options.find((choice) => ` ${norm(choice).replace(/[^a-z0-9]+/g, ' ').trim()} `.includes(wanted));
      if (!option) {
        warn('orange', `Documents « ${item.name} » sans choix correspondant.`, question.cell, 'À quel choix ces documents correspondent-ils ?');
        continue;
      }
      // Un titre, puis une pièce jointe par document, affichés quand le choix est coché.
      const conditions = [...question.conditions, { question: question.n, equals: option }];
      out.push({
        question: { ...attachment(question, `Documents à fournir : ${option}`, false, [], conditions).question, type: 'label' as const },
        from: null,
      });
      for (const document of item.documents) out.push(attachment(question, document, cases.required, [], conditions));
    }
  }
  // « Autre (Préciser) » : on ne sait pas ce que la personne choisira, elle le décrit.
  const withOther = (index: number) => {
    const { question } = out[index];
    if (out[index].from === null || !(question.type === 'select' || question.type === 'checkbox')) return [];
    const others = question.options.filter((option) => OTHER_OPTION.test(norm(option)));
    return others.flatMap((option) => {
      const conditions = [...question.conditions, { question: question.n, equals: option }];
      const complement = (label: string, type: 'text' | 'attachment') => ({
        question: { ...attachment(question, label, true, [], conditions).question, type, partOf: question.n },
        from: null,
      });
      return casesOf.has(question.n)
        ? [complement('Document joint', 'attachment'), complement('Description du document joint', 'text')]
        : [complement(`Précisez « ${option.replace(/\s*\(.*\)\s*$/, '')} »`, 'text')];
    });
  };
  for (let index = out.length - 1; index >= 0; index--) {
    const added = withOther(index);
    if (added.length === 0) continue;
    // Juste après la question et ses documents par choix.
    let end = index + 1;
    while (end < out.length && out[end].from === null && out[end].question.conditions.some((c) => c.question === out[index].question.n)) end++;
    out.splice(end, 0, ...added);
  }
  const renumber = new Map<number, number>();
  out.forEach(({ from }, index) => {
    if (from !== null) renumber.set(from, index + 1);
  });
  return out.map(({ question }, index) => ({
    ...question,
    n: index + 1,
    conditions: question.conditions.map((condition) => ({ ...condition, question: renumber.get(condition.question) ?? condition.question })),
    ...(question.partOf !== undefined ? { partOf: renumber.get(question.partOf) ?? question.partOf } : {}),
  }));
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
