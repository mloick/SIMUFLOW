import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import {
  addCondition,
  addQuestion,
  answersOf,
  changeType,
  cleanForm,
  conditionSources,
  dependants,
  moveQuestion,
  readFormTemplate,
  readTableFile,
  removeCondition,
  removeQuestion,
  splitDocuments,
  updateQuestion,
} from '..';

const template = () => readFormTemplate(readTableFile('template-formulaire.xlsx', lireExemple('template-formulaire.xlsx')))!;
const labels = (form: ReturnType<typeof template>) => form.questions.map((question) => question.label);

describe('modifier un formulaire', () => {
  it('supprime une question, renumérote et retire les conditions qui la visaient', () => {
    const form = template();
    expect(dependants(form, 3).map((question) => question.n)).toEqual([4]);
    const next = removeQuestion(form, 3);
    expect(next.questions).toHaveLength(form.questions.length - 1);
    expect(next.questions.map((question) => question.n)).toEqual(next.questions.map((_, index) => index + 1));
    // « Si NON : indiquer le signataire » s'affiche désormais toujours.
    expect(next.questions[2].label).toBe('Si NON : indiquer le signataire');
    expect(next.questions[2].conditions).toEqual([]);
    // Les conditions sur « Quel changement » (5, devenue 4) suivent.
    expect(next.questions[4].conditions).toEqual([{ question: 4, equals: "MOTIF 1 : Changement d'adresse" }]);
    expect(form.questions).toHaveLength(19);
  });

  it('déplace une question, conditions comprises', () => {
    const form = template();
    const next = moveQuestion(form, 3, -1);
    expect(labels(next).slice(1, 3)).toEqual(['Êtes-vous le signataire du dossier ?', 'Situation']);
    expect(next.questions[3].conditions).toEqual([{ question: 2, equals: 'Non' }]);
    expect(moveQuestion(form, 1, -1)).toBe(form);
  });

  it('ajoute une question après une autre, dans le même cas', () => {
    const form = template();
    const { form: next, n } = addQuestion(form, 4, 'attachment');
    expect(n).toBe(5);
    expect(next.questions[4]).toMatchObject({ n: 5, type: 'attachment', label: '', conditions: [{ question: 3, equals: 'Non' }] });
    expect(next.questions[5].label).toBe('Quel changement souhaitez-vous ?');
    expect(next.questions[6].conditions).toEqual([{ question: 6, equals: "MOTIF 1 : Changement d'adresse" }]);
    expect(addQuestion(form, 0).n).toBe(1);
  });

  it('change le type, l’obligation, les choix et les conditions', () => {
    let form = template();
    form = changeType(form, 12, 'yesno');
    form = updateQuestion(form, 12, { mandatory: true, label: 'Date imposée ?' });
    expect(form.questions[11]).toMatchObject({ type: 'yesno', typeText: 'Oui / non', mandatory: true });
    expect(answersOf(form.questions[11])).toEqual(['Oui', 'Non']);
    expect(conditionSources(form, 13).map((question) => question.n)).toEqual([2, 3, 5, 12]);
    form = addCondition(form, 13, { question: 12, equals: 'Oui' });
    expect(form.questions[12].conditions).toEqual([{ question: 2, equals: 'Cas 3' }, { question: 12, equals: 'Oui' }]);
    expect(addCondition(form, 13, { question: 12, equals: 'Oui' })).toBe(form);
    form = removeCondition(form, 13, 0);
    expect(form.questions[12].conditions).toEqual([{ question: 12, equals: 'Oui' }]);
  });

  it('nettoie les listes avant d’enregistrer', () => {
    const form = updateQuestion(template(), 2, { options: ['Cas 1', '', ' Cas 2 ', ''], label: '  ', help: ' ' });
    expect(cleanForm(form).questions[1]).toMatchObject({ options: ['Cas 1', 'Cas 2'], label: 'Question sans titre', help: null });
  });
});

describe('pièces jointes', () => {
  it('fait une pièce jointe par document, avec les mêmes conditions et la même obligation', () => {
    let form = template();
    const { form: added, n } = addQuestion(form, 4, 'attachment');
    form = updateQuestion(added, n, { label: 'Pièces du signataire', mandatory: true, documents: ['Pièce d’identité', '', 'Procuration'] });
    const next = splitDocuments(form, n);
    expect(next.questions.slice(n - 1, n + 2).map(({ label, type, mandatory, conditions }) => ({ label, type, mandatory, conditions }))).toEqual([
      { label: 'Pièces du signataire', type: 'container', mandatory: true, conditions: [{ question: 3, equals: 'Non' }] },
      { label: 'Pièce d’identité', type: 'attachment', mandatory: true, conditions: [{ question: 3, equals: 'Non' }] },
      { label: 'Procuration', type: 'attachment', mandatory: true, conditions: [{ question: 3, equals: 'Non' }] },
    ]);
    expect(next.questions).toHaveLength(form.questions.length + 2);
    expect(splitDocuments(template(), 2)).toEqual(template());
  });
});
