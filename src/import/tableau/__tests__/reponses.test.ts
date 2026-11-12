import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import {
  answerProblem,
  answerSummary,
  checkAnswers,
  expectsAnswer,
  readFormTemplate,
  readTableFile,
  visibleQuestions,
  type FormAnswers,
  type FormQuestion,
} from '..';

const template = readFormTemplate(readTableFile('template-formulaire.xlsx', lireExemple('template-formulaire.xlsx')))!;
const numbers = (answers: FormAnswers) => visibleQuestions(template.questions, answers).map((question) => question.n);

const question = (overrides: Partial<FormQuestion>): FormQuestion => ({
  n: 1,
  label: 'Question',
  type: 'text',
  typeText: '',
  mandatory: true,
  explanation: null,
  options: [],
  fields: [],
  documents: [],
  help: null,
  example: null,
  conditions: [],
  conditionText: null,
  cell: 'C3',
  ...overrides,
});

/** Une demande complète sur l'exemple : signataire, changement d'adresse. */
const complete: FormAnswers = {
  1: { 'N° de dossier': 'D-001', Nom: 'Martin', Téléphone: '0600000000' },
  2: 'Cas 1',
  3: 'Oui',
  5: ["MOTIF 1 : Changement d'adresse"],
  6: '12 rue des Lilas',
  8: ['justificatif.pdf'],
};

describe('questions affichées', () => {
  it('cache les questions conditionnelles tant que la réponse attendue n’est pas donnée', () => {
    expect(numbers({})).toEqual([1, 2, 3, 5, 8, 9]);
    expect(numbers({ 3: 'Non' })).toEqual([1, 2, 3, 4, 5, 8, 9]);
    expect(numbers({ 2: 'Cas 3', 5: ['MOTIF 2 : Changement de contact'] })).toEqual([1, 2, 3, 5, 7, 8, 9, 10]);
  });

  it('ne tient pas compte de la réponse d’une question cachée', () => {
    const questions = [
      question({ n: 1, type: 'yesno' }),
      question({ n: 2, type: 'yesno', conditions: [{ question: 1, equals: 'Oui' }] }),
      question({ n: 3, conditions: [{ question: 2, equals: 'Oui' }] }),
    ];
    expect(visibleQuestions(questions, { 1: 'Oui', 2: 'Oui' }).map((q) => q.n)).toEqual([1, 2, 3]);
    expect(visibleQuestions(questions, { 1: 'Non', 2: 'Oui' }).map((q) => q.n)).toEqual([1]);
  });
});

describe('vérification avant l’envoi', () => {
  it('signale les réponses obligatoires manquantes des seules questions affichées', () => {
    expect([...checkAnswers(template.questions, {}).entries()]).toEqual([
      [1, 'Remplissez tous les champs.'],
      [2, 'Réponse obligatoire.'],
      [3, 'Réponse obligatoire.'],
      [5, 'Réponse obligatoire.'],
      [8, 'Ajoutez au moins un fichier.'],
    ]);
    expect(checkAnswers(template.questions, complete).size).toBe(0);
    expect([...checkAnswers(template.questions, { ...complete, 3: 'Non' }).keys()]).toEqual([4]);
  });

  it('demande tous les champs d’un libellé obligatoire', () => {
    expect(checkAnswers(template.questions, { ...complete, 1: { Nom: 'Martin' } }).get(1)).toBe('Remplissez tous les champs.');
  });

  it('vérifie le format des e-mails, adresses web, IP et dates', () => {
    expect(answerProblem(question({ type: 'email' }), 'nom@exemple')).toMatch(/e-mail/);
    expect(answerProblem(question({ type: 'email' }), 'nom@exemple.fr')).toBeNull();
    expect(answerProblem(question({ type: 'url' }), 'exemple.fr')).toMatch(/https/);
    expect(answerProblem(question({ type: 'url' }), 'https://exemple.fr/page')).toBeNull();
    expect(answerProblem(question({ type: 'ip' }), '300.1.1.1')).toMatch(/IP/);
    expect(answerProblem(question({ type: 'ip' }), '192.168.1.10')).toBeNull();
    expect(answerProblem(question({ type: 'date' }), '31/02/2026')).toMatch(/jj\/mm\/aaaa/);
    expect(answerProblem(question({ type: 'date', mandatory: false }), '28/02/2026')).toBeNull();
    expect(answerProblem(question({ type: 'datetime' }), '28/02/2026 14:30')).toBeNull();
    expect(answerProblem(question({ type: 'datetime' }), '28/02/2026')).toMatch(/hh:mm/);
    expect(answerProblem(question({ type: 'date', mandatory: false }), '')).toBeNull();
  });

  it('n’attend pas de réponse aux titres, séparateurs et listes de l’outil', () => {
    expect(expectsAnswer(question({ type: 'container' }))).toBe(false);
    expect(expectsAnswer(question({ type: 'reference' }))).toBe(false);
    expect(expectsAnswer(question({ type: 'label' }))).toBe(false);
    expect(expectsAnswer(question({ type: 'label', fields: ['Nom'] }))).toBe(true);
    expect(answerProblem(question({ type: 'list' }), undefined)).toBeNull();
  });
});

describe('récapitulatif', () => {
  it('reprend les réponses des questions affichées, dans l’ordre', () => {
    expect(answerSummary(template.questions, { ...complete, 4: { Nom: 'oublié' } })).toEqual([
      { n: 1, label: expect.any(String), answer: 'N° de dossier : D-001 · Nom : Martin · Téléphone : 0600000000' },
      { n: 2, label: expect.any(String), answer: 'Cas 1' },
      { n: 3, label: expect.any(String), answer: 'Oui' },
      { n: 5, label: expect.any(String), answer: "MOTIF 1 : Changement d'adresse" },
      { n: 6, label: expect.any(String), answer: '12 rue des Lilas' },
      { n: 8, label: expect.any(String), answer: 'justificatif.pdf' },
    ]);
  });
});
