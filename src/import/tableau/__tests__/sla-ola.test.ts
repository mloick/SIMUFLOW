import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import {
  classifyStepCell,
  columnLetter,
  formatSituationWarning,
  readSlaOlaSheet,
  readTableFile,
  workbookToSituations,
  type Sheet,
  type Situation,
} from '..';

const sheet = (rows: string[][], merges: Sheet['merges'] = []): Sheet => ({ name: 'Onglet', rows, merges });
const levels = (situation: Situation, level: string) =>
  situation.warnings.filter((warning) => warning.level === level).map((warning) => warning.message);

/** L'exemple fictif du §10 de la spécification, colonnes décalées comprises. */
const HEADER = ['Famille', 'Situation', 'Propriétaire', 'SLA', 'Groupe 1', 'Task 1', 'OLA 1', 'Groupe 2', 'Task 2', 'OLA 2', '', ''];
const CAS_1 = [
  'Famille X',
  'Cas 1',
  'Service P',
  '6 jours ouvrés',
  'Groupe A',
  'Task - Fournir le document',
  '3 jours ouvrés\n- Si pas de rep après 3JO alors création auto de la task étape 2',
  'Groupe B',
  'Task - Fournir le document',
  '3 jours ouvrés',
  'Solved/Not solved/No answer : clôture ticket',
  'Clôture service P',
];
const CAS_2 = [
  'Famille X',
  'Cas 2',
  'Service P',
  '5 jours ouvrés',
  'Groupe C',
  'Task - Corriger le contrat',
  '5 jours ouvrés\n- Si pas de rep après 5JO clôture\n- Si Ok clôture service P',
  'Solved/Not solved/No answer : clôture ticket',
  'Clôture service P',
  'Service P reprend la main',
  '',
  '',
];

/** Une ligne de l'exemple, l'étape 1 et la suite (cellules à partir de « Groupe 1 »). */
const row = (label: string, sla: string, ...steps: string[]) => ['Famille X', label, 'Service P', sla, ...steps];
const one = (sla: string, ...steps: string[]) => readSlaOlaSheet(sheet([HEADER, row('Cas', sla, ...steps)]), 0).situations[0];

describe('exemple du §10', () => {
  const { situations, skipped } = readSlaOlaSheet(sheet([HEADER, CAS_1, CAS_2]), 0);

  it('donne le modèle attendu pour les deux cas', () => {
    expect(skipped).toBe(0);
    expect(situations.map(({ family, label, owner, slaDays, variant, closure }) => ({
      family,
      label,
      owner,
      slaDays,
      variant,
      closure,
    }))).toEqual([
      { family: 'Famille X', label: 'Cas 1', owner: 'Service P', slaDays: 6, variant: 'escalation', closure: { group: 'Service P', always: true } },
      { family: 'Famille X', label: 'Cas 2', owner: 'Service P', slaDays: 5, variant: 'one_step', closure: { group: 'Service P', always: true } },
    ]);
    expect(situations[0].steps.map(({ n, group, task, olaDays, condition }) => ({ n, group, task, olaDays, condition }))).toEqual([
      { n: 1, group: 'Groupe A', task: 'Fournir le document', olaDays: 3, condition: null },
      { n: 2, group: 'Groupe B', task: 'Fournir le document', olaDays: 3, condition: 'task1 not solved' },
    ]);
    expect(situations[1].steps.map(({ n, group, task, olaDays }) => ({ n, group, task, olaDays }))).toEqual([
      { n: 1, group: 'Groupe C', task: 'Corriger le contrat', olaDays: 5 },
    ]);
    expect(situations.every((situation) => situation.noAnswerIsNotSolved)).toBe(true);
  });

  it('n’avertit que sur la reprise en main du cas 2', () => {
    expect(levels(situations[0], 'orange')).toEqual([]);
    expect(levels(situations[0], 'rouge')).toEqual([]);
    expect(levels(situations[1], 'orange')).toEqual(['Reprise en main mentionnée sans task 2 : confirmer avec le métier']);
    expect(levels(situations[1], 'rouge')).toEqual([]);
  });

  it('lit le cas 2 malgré ses colonnes décalées, et le dit', () => {
    // Le texte de clôture est sous « Groupe 2 » : il ne devient pas un groupe.
    expect(situations[1].steps).toHaveLength(1);
    expect(levels(situations[1], 'info')[0]).toMatch(/^Colonnes décalées : texte de clôture lu sous « Groupe 2 »/);
    expect(situations[1].warnings[0].cell).toBe('H3');
  });

  it('cite l’onglet et la cellule, et propose une question au métier', () => {
    const warning = situations[1].warnings.find((item) => item.level === 'orange');
    expect(warning?.question).toBe('Le propriétaire reprend-il la main sans task 2 ?');
    expect(formatSituationWarning(situations[1], warning!)).toBe(
      '« Onglet », cellule J3 : Reprise en main mentionnée sans task 2 : confirmer avec le métier',
    );
  });
});

describe('les cinq variantes', () => {
  it('une étape', () => {
    const situation = one('5 jours ouvrés', 'Groupe C', 'Task - Corriger', '5 jours ouvrés\n- Si pas de rep après 5JO clôture');
    expect(situation.variant).toBe('one_step');
    expect(situation.warnings).toEqual([]);
  });

  it('deux étapes avec escalade', () => {
    const situation = one(
      '6 jours ouvrés',
      'Groupe A',
      'Task - Fournir',
      '3 jours ouvrés\n- Si pas de rep après 3JO alors création auto de la task étape 2',
      'Groupe B',
      'Task - Fournir',
      '3 jours ouvrés',
    );
    expect(situation.variant).toBe('escalation');
    expect(situation.steps[1].condition).toBe('task1 not solved');
  });

  it('étape 2 seulement si accord', () => {
    const situation = one(
      '8 jours ouvrés',
      'Groupe A',
      'Task - Donner l’accord',
      '3 jours ouvrés\n- Si Ok après 3JO alors création auto de la task étape 2\n- Si pas Ok clôture',
      'Groupe D',
      'Task - Préparer le versement',
      '5 jours ouvrés',
    );
    expect(situation.variant).toBe('conditional_step2');
    expect(situation.steps[1].condition).toBe('task1 solved');
    expect(levels(situation, 'orange')).toEqual([]);
  });

  it('reprise en main : pas de task 2 inventée, avertissement', () => {
    const situation = one(
      '6 jours ouvrés',
      'Groupe G',
      'Task - Faire signer',
      '3 jours ouvrés\n- Si pas de rep après 3JO alors création auto de la task étape 2',
      'Le service R reprend la main et clôturera après la résolution',
    );
    expect(situation.variant).toBe('takeover');
    expect(situation.steps).toHaveLength(1);
    expect(levels(situation, 'orange')).toEqual([
      'L’étape 2 est annoncée, mais le propriétaire reprend la main sans task 2 : aucune task inventée.',
    ]);
  });

  it('escalade seulement si cas complexe', () => {
    const situation = one(
      '6 jours ouvrés',
      'Groupe H',
      'Task - Revoir la clause',
      '3 jours ouvrés\n- Si Ok clôture\n- Si complexe alors création auto de la task étape 2',
      'Groupe I',
      'Task - Revoir la clause',
      '3 jours ouvrés',
    );
    expect(situation.variant).toBe('complex_escalation');
    expect(situation.steps[1].condition).toBe('task1 not solved et cas complexe');
    expect(situation.warnings.find((warning) => warning.level === 'orange')).toMatchObject({
      message: 'Le critère « complexe » n’est pas défini.',
      question: 'Qu’est-ce qu’un « cas complexe », et qui le décide ?',
    });
  });
});

describe('contrôles', () => {
  it('un SLA différent de la somme des OLA donne un avertissement orange', () => {
    const situation = one('4 jours ouvrés', 'Groupe E', 'Task - Vérifier', '3 jours ouvrés\n- Si pas de rep alors création auto de la task étape 2', 'Groupe F', 'Task - Vérifier', '3 jours ouvrés');
    expect(levels(situation, 'orange')).toEqual(['SLA de 4 JO différent de OLA 1 + OLA 2 (6 JO).']);
    expect(situation.warnings[0].cell).toBe('D2');
  });

  it('« étape 2 » annoncée sans groupe : avertissement orange, pas de task inventée', () => {
    const situation = one('6 jours ouvrés', 'Groupe A', 'Task - Fournir', '3 jours ouvrés\n- Si pas de rep après 3JO alors création auto de la task étape 2');
    expect(situation.steps).toHaveLength(1);
    expect(situation.variant).toBe('one_step');
    expect(levels(situation, 'orange')).toEqual(['Étape 2 annoncée sans groupe ni task : aucune task inventée.']);
  });

  it('SLA ou groupe absent : avertissements rouges', () => {
    const situation = one('', '', 'Task - Fournir', '3 jours ouvrés');
    expect(levels(situation, 'rouge')).toEqual(['SLA absent.', 'Pas de groupe de compétence pour l’étape 1.']);
  });

  it('un SLA plus long que l’OLA seul est une simple information', () => {
    const situation = one('6 jours ouvrés', 'Groupe A', 'Task - Fournir', '5 jours ouvrés');
    expect(levels(situation, 'orange')).toEqual([]);
    expect(levels(situation, 'info')).toEqual(['SLA de 6 JO pour un OLA 1 de 5 JO : 1 JO de marge.']);
  });

  it('« Si pas complexe » sans étape 2 devient une note de la task 1', () => {
    const situation = one('3 jours ouvrés', 'Si pas complexe', 'Groupe A', 'Task - Fournir', '3 jours ouvrés');
    expect(situation.steps[0].note).toBe('Si pas complexe');
    expect(situation.steps[0].condition).toBeNull();
    expect(levels(situation, 'orange')).toEqual(['« Si pas complexe » sans étape 2 : gardé en note de la task 1.']);
  });
});

describe('lecture des lignes', () => {
  it('propage la famille fusionnée et saute les situations pas encore décrites', () => {
    const rows = [HEADER, CAS_1, ['', 'Cas 2', ...CAS_2.slice(2)], ['', 'Cas 3', '', '', '', '', '', '', '', '', '', ''], ['Famille Y', 'Cas 4', ...CAS_2.slice(2)]];
    const { situations, skipped } = readSlaOlaSheet(sheet(rows, [{ top: 1, left: 0, bottom: 3, right: 0 }]), 0);
    expect(situations.map((situation) => [situation.family, situation.label, situation.row])).toEqual([
      ['Famille X', 'Cas 1', 2],
      ['Famille X', 'Cas 2', 3],
      ['Famille Y', 'Cas 4', 5],
    ]);
    expect(skipped).toBe(1);
  });

  it('reconnaît les colonnes sans titre à leur contenu', () => {
    const rows = [
      ['', '', '', '', 'Propriétaire', 'SLA', 'Groupe de compétence 1', 'Task 1', 'OLA 1'],
      ['Famille Z', 'Selection Code compte', 'Situation A', 'Menu déroulant', 'Service P', '3 jours ouvrés', 'Groupe A', 'Task - Fournir', '3 jours ouvrés'],
      ['', 'Selection Code compte', 'Situation B', '', 'Service P', '3 jours ouvrés', 'Groupe A', 'Task - Fournir', '3 jours ouvrés'],
    ];
    const { situations } = readSlaOlaSheet(sheet(rows), 0);
    expect(situations.map(({ family, label, formFields }) => [family, label, formFields])).toEqual([
      ['Famille Z', 'Situation A', ['Code compte (sélection)']],
      ['Famille Z', 'Situation B', ['Code compte (sélection)']],
    ]);
  });
});

describe('classifyStepCell', () => {
  it('classe chaque cellule par son contenu', () => {
    expect(classifyStepCell('Task - Fournir le doc\n(ajouter manuellement un commentaire sur la task)')).toEqual({
      kind: 'task',
      task: 'Fournir le doc',
      note: 'ajouter manuellement un commentaire sur la task',
    });
    expect(classifyStepCell('Task - Fournir le/les numéro(s) de facture')).toMatchObject({ task: 'Fournir le/les numéro(s) de facture', note: null });
    expect(classifyStepCell('group Groupe B + assignee manuel\nSolved\nNot Solved\nNo answer')).toEqual({
      kind: 'group',
      group: 'Groupe B',
      manualAssignee: true,
    });
    expect(classifyStepCell('Groupe A')).toEqual({ kind: 'group', group: 'Groupe A', manualAssignee: false });
    expect(classifyStepCell('3 JO')).toMatchObject({ kind: 'ola', days: 3 });
    expect(classifyStepCell('Clôture service P')).toEqual({ kind: 'closure-group', group: 'Service P' });
    expect(classifyStepCell('Solved/Not solved/No answer: Cloture ticket\nPersonne 1')).toEqual({ kind: 'closure-rule' });
    expect(classifyStepCell('Solved\nPassage étape 2\nNot solved/No answer: Cloture ticket')).toMatchObject({ kind: 'rule' });
    expect(classifyStepCell('Reopen task manuellement après étude de la réponse')).toMatchObject({ kind: 'reopen' });
    expect(classifyStepCell('Menu déroulant')).toEqual({ kind: 'skip' });
    expect(classifyStepCell('Si pas complexe')).toEqual({ kind: 'not-complex' });
  });

  it('donne les lettres de colonne comme Excel', () => {
    expect([0, 25, 26, 51, 701].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ']);
  });
});

describe('workbookToSituations', () => {
  it('lit toutes les situations du classeur d’exemple', () => {
    const workbook = readTableFile('workflow-sla-ola.xlsx', lireExemple('workflow-sla-ola.xlsx'));
    const { situations, skipped } = workbookToSituations(workbook);
    expect(skipped).toBe(0);
    expect(situations.map(({ sheet: name, family, label, variant }) => [name, family, label, variant])).toEqual([
      ['Dossier de financement', 'Famille X', 'Cas 1', 'escalation'],
      ['Dossier de financement', 'Famille X', 'Cas 2', 'one_step'],
      ['Dossier de financement', 'Famille X', 'Cas 3', 'conditional_step2'],
      ['Dossier de financement', 'Famille Y', 'Cas 4', 'escalation'],
      ['Contrat', 'Famille Z', 'Cas 5', 'takeover'],
      ['Contrat', 'Famille Z', 'Cas 6', 'complex_escalation'],
    ]);
    const cas4 = situations[3];
    expect(cas4.steps[0]).toMatchObject({ group: 'Groupe E', manualAssignee: true });
    expect(cas4.notes).toContain('SLA à confirmer');
    expect(cas4.formFields).toEqual(['n° de dossier', 'montant']);
    expect(levels(cas4, 'orange')).toContain('SLA de 4 JO différent de OLA 1 + OLA 2 (6 JO).');
    expect(situations[4].notes).toContain('Reopen possible');
  });
});
