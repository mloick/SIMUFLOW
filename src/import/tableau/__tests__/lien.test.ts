import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import {
  chosenSituation,
  describeWorkbook,
  findFormLink,
  readFormTemplate,
  readTableFile,
  situationOfOption,
  workbookToSituations,
} from '..';

const workbook = readTableFile('formulaire-et-workflow.xlsx', lireExemple('formulaire-et-workflow.xlsx'));
const form = readFormTemplate(workbook)!;
const { situations } = workbookToSituations(workbook);

describe('formulaire et workflow dans un même classeur', () => {
  it('reconnaît le classeur comme un formulaire avec son workflow', () => {
    expect(describeWorkbook(workbook).kind).toBe('formulaire-workflow');
    expect(form.questions).toHaveLength(19);
    expect(situations).toHaveLength(6);
  });

  it('trouve la question dont les choix sont les situations', () => {
    const link = findFormLink(form, situations)!;
    expect(link.question.label).toBe('Situation');
    expect(link.matches).toEqual([0, 1, 2, 3, 4, 5]);
    expect(link.linked).toBe(6);
  });

  it('donne la situation choisie dans les réponses', () => {
    expect(chosenSituation(form, situations, { 2: 'Cas 3' })).toEqual({ kind: 'situation', index: 2, option: 'Cas 3' });
    expect(chosenSituation(form, situations, {})).toEqual({ kind: 'unanswered' });
    expect(chosenSituation(form, situations.slice(0, 2), { 2: 'Cas 5' })).toEqual({ kind: 'unmatched', option: 'Cas 5' });
    expect(chosenSituation(form, [], { 2: 'Cas 1' })).toEqual({ kind: 'no-link' });
  });
});

describe('correspondance d’un choix et d’une situation', () => {
  it('ignore accents, majuscules et ce qui suit « : »', () => {
    expect(situationOfOption('cas 2', situations)).toBe(1);
    expect(situationOfOption('Cas 4 : montant', situations)).toBe(3);
    expect(situationOfOption('Autre', situations)).toBe(-1);
    expect(situationOfOption('', situations)).toBe(-1);
  });

  it('un template seul n’est lié à rien', () => {
    const alone = readTableFile('template-formulaire.xlsx', lireExemple('template-formulaire.xlsx'));
    expect(describeWorkbook(alone).kind).toBe('formulaire');
    expect(workbookToSituations(alone).situations).toEqual([]);
  });
});
