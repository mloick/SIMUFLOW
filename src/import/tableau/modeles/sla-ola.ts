/**
 * Modèle « workflow avec SLA et OLA » : un onglet où chaque ligne est une
 * situation (un choix du menu déroulant d'un formulaire de demande), avec son
 * propriétaire, son SLA, puis une ou plusieurs étapes (groupe de compétence,
 * task, OLA) et la clôture.
 *
 * Le piège de ces tableaux : les colonnes se décalent. Quand une situation n'a
 * pas d'étape 2, le texte de clôture se retrouve sous « Groupe de compétence 2 ».
 * La zone des étapes est donc lue cellule par cellule, de gauche à droite, et
 * chaque cellule est classée d'après son contenu, jamais d'après sa colonne :
 * « Task - … » est une task, « 3 jours ouvrés … » un OLA, « Clôture service … »
 * le groupe qui clôture, un nom court un groupe de compétence…
 *
 * Le résultat est un modèle normalisé par situation (étapes, variante de
 * décision, notes, avertissements avec la cellule d'origine et la question à
 * poser au métier). La génération du process vient ensuite.
 * Fonctions pures, testées dans __tests__/sla-ola.test.ts.
 */

import { filledRows } from '../grid';
import type { Sheet } from '../types';

/**
 * Les cinq façons d'enchaîner les étapes :
 * - `one_step` : une task, puis la clôture ;
 * - `escalation` : task 2 quand la task 1 n'est pas résolue (ou sans réponse) ;
 * - `conditional_step2` : task 2 seulement quand la task 1 est résolue (accord obtenu) ;
 * - `takeover` : étape 2 annoncée, mais le propriétaire reprend la main, sans task 2 ;
 * - `complex_escalation` : task 2 seulement si le cas est jugé complexe.
 */
export type WorkflowVariant = 'one_step' | 'escalation' | 'conditional_step2' | 'takeover' | 'complex_escalation';

/** Gravité d'un avertissement, comme les pastilles du diagnostic : rouge, orange, ou simple information. */
export type WarningLevel = 'rouge' | 'orange' | 'info';

export type SituationWarning = {
  level: WarningLevel;
  message: string;
  /** Cellule d'origine, comme dans Excel (« N7 »). */
  cell?: string;
  /** La question à poser à l'expert métier : l'app ne tranche pas à sa place. */
  question?: string;
};

export type WorkflowStep = {
  /** Numéro de l'étape, à partir de 1. */
  n: number;
  /** Groupe de compétence qui reçoit la task. */
  group: string | null;
  /** Ce que la task demande (sans le « Task - »). */
  task: string | null;
  /** Délai accordé au groupe, en jours ouvrés. */
  olaDays: number | null;
  /** L'assignee de la task est saisi à la main. */
  manualAssignee: boolean;
  note: string | null;
  /** Quand la task est créée (« task1 not solved »…), pour l'étape 2. */
  condition: string | null;
};

export type Situation = {
  sheet: string;
  /** Numéro de la ligne dans l'onglet, comme dans Excel. */
  row: number;
  family: string;
  label: string;
  helpText: string | null;
  formFields: string[];
  owner: string | null;
  /** Délai global promis au demandeur, en jours ouvrés. */
  slaDays: number | null;
  variant: WorkflowVariant;
  steps: WorkflowStep[];
  /** C'est toujours le service propriétaire qui clôture le ticket. */
  closure: { group: string | null; always: true };
  /** Sans réponse dans l'OLA, la task compte comme non résolue. */
  noAnswerIsNotSolved: true;
  notes: string[];
  warnings: SituationWarning[];
};

export type SlaOlaSheetResult = {
  situations: Situation[];
  /** Lignes qui nomment une situation sans rien en dire encore (ni SLA ni étape). */
  skipped: number;
};

// ---------------------------------------------------------------------------
// Textes

/** Minuscules, sans accents, espaces simples ; les retours à la ligne sont gardés. */
const norm = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();

/** « 3 jours ouvrés », « 5 JO », « 2,5 jours ouvrés » en début de texte. */
const DAYS = /^(\d+(?:[.,]\d+)?)\s*(?:jours?\s*ouvr|jo\b)/;

const days = (text: string): number | null => {
  const match = DAYS.exec(norm(text));
  return match ? Number(match[1].replace(',', '.')) : null;
};

/** Lettre de colonne comme dans Excel : 0 → A, 26 → AA. */
export function columnLetter(index: number): string {
  let letter = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

const cellRef = (column: number, row: number) => `${columnLetter(column)}${row}`;

// ---------------------------------------------------------------------------
// Colonnes

type ColumnRole = 'family' | 'label' | 'help' | 'owner' | 'sla' | 'field' | 'description' | 'note' | 'step' | 'ignore';

/** Rôle d'une colonne d'après son titre ; `null` pour un titre vide. */
function headerRole(header: string): ColumnRole | null {
  const text = norm(header).replace(/\n/g, ' ');
  if (!text) return null;
  if (/\bsla\b/.test(text)) return 'sla';
  if (/\bchamps?\b/.test(text)) return 'field';
  if (/commentaire|remarque|\bnotes?\b|no answer/.test(text)) return 'note';
  if (/\bola\b|\bgroupe?s?\b|\btasks?\b|tache|\betapes?\b|traitement/.test(text)) return 'step';
  if (/proprietaire|\bowner\b/.test(text)) return 'owner';
  if (/explicite|\baide\b|\bhelp\b/.test(text)) return 'help';
  if (/^description/.test(text)) return 'description';
  if (/sous[ -]?rubrique|situation|libelle|\bchoix\b|sous[ -]?nature/.test(text)) return 'label';
  if (/famille|categor|rubrique/.test(text)) return 'family';
  return 'ignore';
}

const isMarker = (text: string) => /^menu deroulant$/.test(norm(text));
const isSelection = (text: string) => /^selection\b/.test(norm(text));

type Columns = {
  family: number | null;
  label: number | null;
  help: number | null;
  owner: number | null;
  sla: number | null;
  description: number | null;
  /** Colonnes de champs du formulaire, et colonnes « Selection … » (champ de sélection). */
  fields: number[];
  selections: number[];
  notes: number[];
  /** Zone des étapes : lue cellule par cellule, de gauche à droite. */
  steps: number[];
};

/**
 * Rôle de chaque colonne. Les titres connus d'abord ; puis, avant la zone des
 * étapes, les colonnes sans titre d'après leur contenu (« Menu déroulant »,
 * « Selection … »), la première restante étant la famille et la dernière la
 * situation quand aucune colonne ne porte ce titre.
 */
function findColumns(header: string[], body: string[][]): Columns {
  const columns: Columns = {
    family: null,
    label: null,
    help: null,
    owner: null,
    sla: null,
    description: null,
    fields: [],
    selections: [],
    notes: [],
    steps: [],
  };
  const width = Math.max(header.length, ...body.map((row) => row.length));
  const roles = Array.from({ length: width }, (_, column) => headerRole(header[column] ?? ''));
  const firstStep = roles.indexOf('step');
  const untitled: number[] = [];

  roles.forEach((role, column) => {
    if (firstStep >= 0 && column > firstStep && (role === null || role === 'step' || role === 'ignore')) {
      // Après le début des étapes, une colonne sans titre ou au titre inconnu reçoit du texte décalé.
      columns.steps.push(column);
      return;
    }
    switch (role) {
      case 'step':
        columns.steps.push(column);
        break;
      case 'field':
        columns.fields.push(column);
        break;
      case 'note':
        columns.notes.push(column);
        break;
      case 'family':
      case 'label':
      case 'help':
      case 'owner':
      case 'sla':
      case 'description':
        if (columns[role] === null) columns[role] = column;
        break;
      case null: {
        const values = body.map((row) => row[column] ?? '').filter(Boolean);
        if (values.length === 0) break;
        if (values.every(isMarker)) break;
        if (values.every(isSelection)) columns.selections.push(column);
        else untitled.push(column);
        break;
      }
      default:
        break;
    }
  });

  const before = untitled.filter((column) => firstStep < 0 || column < firstStep);
  if (columns.label === null && before.length > 0) columns.label = before.pop() ?? null;
  if (columns.family === null && before.length > 0 && before[0] < (columns.label ?? Infinity)) {
    columns.family = before[0];
  }
  return columns;
}

// ---------------------------------------------------------------------------
// Cellules de la zone des étapes

type StepCell =
  | { kind: 'skip' }
  | { kind: 'task'; task: string; note: string | null }
  | { kind: 'ola'; days: number; text: string }
  | { kind: 'group'; group: string; manualAssignee: boolean }
  | { kind: 'rule'; text: string }
  | { kind: 'closure-rule' }
  | { kind: 'closure-group'; group: string }
  | { kind: 'takeover'; text: string }
  | { kind: 'reopen'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'not-complex' };

/** Classe une cellule d'après son seul contenu (motifs sans accents ni majuscules). */
export function classifyStepCell(raw: string): StepCell {
  const text = raw.trim();
  const plain = norm(text);
  if (!plain || isMarker(text)) return { kind: 'skip' };
  if (/^tasks?\b\s*\d*\s*[-–:]/.test(plain)) {
    // Une parenthèse qui fait phrase est une note ; « numéro(s) » reste dans le texte.
    const notes = [...text.matchAll(/\(([^()]*\s[^()]*)\)/g)].map((match) => match[1].trim()).filter(Boolean);
    const body = text.replace(/\([^()]*\s[^()]*\)/g, '').replace(/^\s*tasks?\s*\d*\s*[-–:]\s*/i, '');
    const task = body
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    return { kind: 'task', task: task ?? '', note: notes.length > 0 ? notes.join(' ; ') : null };
  }
  const ola = days(text);
  if (ola !== null) return { kind: 'ola', days: ola, text };
  if (/^si pas complexe\.?$/.test(plain)) return { kind: 'not-complex' };
  if (/reprend la main/.test(plain)) return { kind: 'takeover', text };
  if (/\breopen|reouverture/.test(plain)) return { kind: 'reopen', text };
  // Texte de décision (« Si pas de retour… passe étape 2 ») avant la règle de clôture qu'il peut contenir.
  if (/creation auto|\bpass(?:e|age)\b[^\n]*etape\s*\d/.test(plain)) return { kind: 'rule', text };
  if (/solved\s*\/\s*not solved/.test(plain) && /clotur/.test(plain)) return { kind: 'closure-rule' };
  const closure = /^cloture (service\b.*)$/.exec(plain.split('\n')[0]);
  if (closure) {
    const rest = text.split('\n')[0].replace(/^\s*cl[oô]ture\s+service\s*/i, '').trim();
    return { kind: 'closure-group', group: rest ? `Service ${rest}` : 'Service' };
  }
  // Le reste se juge à la première ligne : « group X + assignee manuel » peut être suivi de « Solved / Not solved ».
  const firstPlain = plain.split('\n').find(Boolean) ?? '';
  if (/^-?\s*si\b|\bsolved\b|clotur/.test(firstPlain)) return { kind: 'rule', text };
  const first = text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  // Un groupe est un nom court ; une phrase longue est une note.
  if (first.length > 60 || first.split(/\s+/).length > 8) return { kind: 'note', text };
  const group = first
    .replace(/\s*\+?\s*assignee\s+manuel.*$/i, '')
    .replace(/^group\s+/i, '')
    .trim();
  return {
    kind: 'group',
    group: group || first,
    manualAssignee: /assignee manuel|a renseigner manuellement/.test(plain),
  };
}

// ---------------------------------------------------------------------------
// Une situation

type DraftStep = Omit<WorkflowStep, 'n' | 'condition'> & { condition: string | null };

const emptyStep = (): DraftStep => ({
  group: null,
  task: null,
  olaDays: null,
  manualAssignee: false,
  note: null,
  condition: null,
});

/** Lit une ligne de situation. `rowNumber` : numéro de la ligne comme dans Excel. */
function readSituation(
  sheetName: string,
  header: string[],
  row: string[],
  rowNumber: number,
  columns: Columns,
  family: string,
): Situation | null {
  const at = (column: number | null) => (column === null ? '' : (row[column] ?? '').trim());
  const label = at(columns.label).split('\n')[0].trim();
  if (!label) return null;

  const warnings: SituationWarning[] = [];
  const notes: string[] = [];
  const steps: DraftStep[] = [];
  let current: DraftStep | null = null;
  const rules: string[] = [];
  let closureGroup: string | null = null;
  let takeover: { text: string; cell: string } | null = null;
  let notComplex: string | null = null;
  let shifted: string | null = null;
  let stepCells = 0;

  const start = () => {
    current = emptyStep();
    steps.push(current);
    return current;
  };
  /** L'étape en cours, ou une nouvelle si elle a déjà ce renseignement (ou déjà son OLA). */
  const stepFor = (field: 'group' | 'task' | 'olaDays'): DraftStep => {
    const step: DraftStep | null = current;
    if (!step || step[field] !== null || (field !== 'olaDays' && step.olaDays !== null)) return start();
    return step;
  };

  for (const column of columns.steps) {
    const value = at(column);
    if (!value) continue;
    stepCells++;
    const cell = classifyStepCell(value);
    const ref = cellRef(column, rowNumber);
    const underStep = /\b([2-9])\b/.exec(norm(header[column] ?? ''))?.[1];
    switch (cell.kind) {
      case 'task': {
        const step = stepFor('task');
        step.task = cell.task;
        if (cell.note) step.note = cell.note;
        break;
      }
      case 'group': {
        const step = stepFor('group');
        step.group = cell.group;
        step.manualAssignee = cell.manualAssignee;
        break;
      }
      case 'ola':
        stepFor('olaDays').olaDays = cell.days;
        rules.push(cell.text);
        break;
      case 'rule':
        rules.push(cell.text);
        break;
      case 'not-complex':
        notComplex = ref;
        (current ?? start()).condition = 'si pas complexe';
        break;
      case 'closure-group':
        closureGroup ??= cell.group;
        break;
      case 'takeover':
        takeover ??= { text: cell.text, cell: ref };
        break;
      case 'reopen':
      case 'note':
        notes.push(cell.text);
        break;
      default:
        break;
    }
    // Un texte de clôture sous une colonne d'étape 2 ou 3 : la colonne est décalée.
    const closing = cell.kind === 'closure-rule' || cell.kind === 'closure-group' || cell.kind === 'takeover';
    if (closing && underStep && !shifted && steps.filter((step) => step.group || step.task).length < Number(underStep)) {
      shifted = `Colonnes décalées : texte de clôture lu sous « ${(header[column] ?? '').trim()} », classé d'après son contenu.`;
      warnings.push({ level: 'info', message: shifted, cell: ref });
    }
  }

  const slaText = at(columns.sla);
  const slaDays = slaText ? days(slaText) : null;
  const owner = at(columns.owner) || null;
  if (!slaText && stepCells === 0) return null;

  for (const column of columns.notes) {
    const value = at(column);
    if (value) notes.push(value);
  }

  // Étapes réelles : une étape sans task ni groupe n'existe pas.
  const real = steps.filter((step) => step.group || step.task);
  const ruleText = norm(rules.join('\n'));
  const complex = /\bsi complexe\b/.test(ruleText);
  const conditional = /si ok\b[^\n]*creation auto/.test(ruleText);
  const announced = /creation auto|etape\s*2/.test(ruleText);
  const hasStep2 = real.length >= 2;

  let variant: WorkflowVariant = 'one_step';
  if (hasStep2) variant = complex ? 'complex_escalation' : conditional ? 'conditional_step2' : 'escalation';
  else if (announced && takeover) variant = 'takeover';

  const finished: WorkflowStep[] = real.map((step, index) => ({
    ...step,
    n: index + 1,
    condition:
      index === 0
        ? step.condition
        : variant === 'conditional_step2'
          ? 'task1 solved'
          : variant === 'complex_escalation'
            ? 'task1 not solved et cas complexe'
            : 'task1 not solved',
  }));

  // Contrôles (rouge : il manque l'essentiel ; orange : à confirmer avec le métier).
  const slaCell = columns.sla === null ? undefined : cellRef(columns.sla, rowNumber);
  const firstStepCell = columns.steps.length > 0 ? cellRef(columns.steps[0], rowNumber) : undefined;
  const [step1, step2] = finished;
  if (slaDays === null) {
    warnings.push({
      level: 'rouge',
      message: slaText ? `SLA illisible : « ${slaText} ».` : 'SLA absent.',
      cell: slaCell,
      question: 'Quel délai global, en jours ouvrés, est promis au demandeur ?',
    });
  }
  if (!step1?.group) {
    warnings.push({
      level: 'rouge',
      message: 'Pas de groupe de compétence pour l’étape 1.',
      cell: firstStepCell,
      question: 'Quel groupe reçoit la première task ?',
    });
  }
  if (step1 && step1.olaDays === null) {
    warnings.push({
      level: 'rouge',
      message: 'OLA de l’étape 1 absent.',
      cell: firstStepCell,
      question: 'Combien de jours ouvrés le groupe a-t-il pour répondre ?',
    });
  }
  if (step2 && step2.olaDays === null) {
    warnings.push({
      level: 'orange',
      message: 'OLA de l’étape 2 absent.',
      cell: firstStepCell,
      question: 'Combien de jours ouvrés le groupe de l’étape 2 a-t-il ?',
    });
  }
  if (variant === 'takeover') {
    warnings.push({
      level: 'orange',
      message: 'L’étape 2 est annoncée, mais le propriétaire reprend la main sans task 2 : aucune task inventée.',
      cell: takeover?.cell,
      question: 'Faut-il une task 2, et pour quel groupe ?',
    });
  } else if (!hasStep2 && takeover) {
    warnings.push({
      level: 'orange',
      message: 'Reprise en main mentionnée sans task 2 : confirmer avec le métier',
      cell: takeover.cell,
      question: 'Le propriétaire reprend-il la main sans task 2 ?',
    });
  }
  if (!hasStep2 && announced && !takeover) {
    warnings.push({
      level: 'orange',
      message: 'Étape 2 annoncée sans groupe ni task : aucune task inventée.',
      cell: firstStepCell,
      question: 'Quel groupe reçoit la task 2, et pour quoi faire ?',
    });
  }
  if (hasStep2 && !announced) {
    warnings.push({
      level: 'orange',
      message: 'Étape 2 présente, mais aucune règle ne dit quand la créer.',
      cell: firstStepCell,
      question: 'Quand la task 2 est-elle créée : sans réponse, si non résolue, si accord ?',
    });
  }
  if (variant === 'complex_escalation') {
    warnings.push({
      level: 'orange',
      message: 'Le critère « complexe » n’est pas défini.',
      cell: firstStepCell,
      question: 'Qu’est-ce qu’un « cas complexe », et qui le décide ?',
    });
  }
  if (notComplex && !hasStep2) {
    if (step1) {
      step1.note = [step1.note, 'Si pas complexe'].filter(Boolean).join(' ; ');
      step1.condition = null;
    }
    warnings.push({
      level: 'orange',
      message: '« Si pas complexe » sans étape 2 : gardé en note de la task 1.',
      cell: notComplex,
      question: 'Que se passe-t-il quand le cas est complexe ?',
    });
  }
  if (slaDays !== null && step1?.olaDays != null) {
    const total = step1.olaDays + (step2?.olaDays ?? 0);
    if (step2 && slaDays !== total) {
      warnings.push({
        level: 'orange',
        message: `SLA de ${slaDays} JO différent de OLA 1 + OLA 2 (${total} JO).`,
        cell: slaCell,
        question: 'Le SLA doit-il couvrir les deux tasks ?',
      });
    } else if (!step2 && slaDays < step1.olaDays) {
      warnings.push({
        level: 'orange',
        message: `SLA de ${slaDays} JO plus court que l’OLA 1 (${step1.olaDays} JO).`,
        cell: slaCell,
        question: 'Le délai promis au demandeur laisse-t-il le temps au groupe de répondre ?',
      });
    } else if (!step2 && slaDays > step1.olaDays) {
      warnings.push({
        level: 'info',
        message: `SLA de ${slaDays} JO pour un OLA 1 de ${step1.olaDays} JO : ${slaDays - step1.olaDays} JO de marge.`,
        cell: slaCell,
      });
    }
  }

  const formFields: string[] = [];
  for (const column of columns.selections) {
    const value = at(column);
    if (value) formFields.push(`${value.replace(/^\s*s[eé]lection\s*/i, '').trim()} (sélection)`);
  }
  for (const column of columns.fields) {
    const value = at(column);
    if (!value) continue;
    if (/^(x|oui|yes)$/i.test(value)) {
      formFields.push(/description/i.test(header[column] ?? '') ? 'description libre' : (header[column] ?? '').trim());
    } else {
      formFields.push(...value.split('\n').map((line) => line.trim()).filter(Boolean));
    }
  }

  const description = at(columns.description);
  if (description) notes.unshift(description);

  return {
    sheet: sheetName,
    row: rowNumber,
    family,
    label,
    helpText: at(columns.help) || null,
    formFields,
    owner,
    slaDays,
    variant,
    steps: finished,
    closure: { group: closureGroup ?? owner, always: true },
    noAnswerIsNotSolved: true,
    notes,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Un onglet

/**
 * Les situations d'un onglet « SLA / OLA » : chaque ligne sous l'en-tête qui
 * nomme une situation et en dit quelque chose (SLA ou étapes). La famille
 * fusionnée ou laissée vide reprend celle du dessus ; sans colonne famille,
 * c'est le nom de l'onglet. `headerIndex` : ligne d'en-tête (à partir de 0).
 */
export function readSlaOlaSheet(sheet: Sheet, headerIndex: number): SlaOlaSheetResult {
  const rows = filledRows(sheet);
  const header = rows[headerIndex] ?? [];
  const body = rows.slice(headerIndex + 1);
  const columns = findColumns(header, body);
  const situations: Situation[] = [];
  let skipped = 0;
  let family = '';
  body.forEach((row, index) => {
    if (columns.family !== null && row[columns.family]?.trim()) family = row[columns.family].split('\n')[0].trim();
    const situation = readSituation(sheet.name, header, row, headerIndex + index + 2, columns, family || sheet.name);
    if (situation) situations.push(situation);
    else if (columns.label !== null && row[columns.label]?.trim()) skipped++;
  });
  return { situations, skipped };
}

/** « Contrat », cellule J3 : message. */
export function formatSituationWarning(situation: Situation, warning: SituationWarning): string {
  const where = warning.cell ? `cellule ${warning.cell}` : `ligne ${situation.row}`;
  return `« ${situation.sheet} », ${where} : ${warning.message}`;
}

/** Libellés des variantes, pour l'écran. */
export const VARIANT_LABELS: Record<WorkflowVariant, string> = {
  one_step: 'Une étape',
  escalation: 'Deux étapes, escalade si non résolu',
  conditional_step2: 'Étape 2 si accord',
  takeover: 'Reprise en main par le propriétaire',
  complex_escalation: 'Étape 2 si cas complexe',
};
