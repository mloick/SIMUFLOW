import { describe, expect, it } from '@jest/globals';

import { lireExemple } from '../../../../jest/lire-exemple';
import { isQuestionVisible, questionType, readFormTemplate, readTableFile, type Sheet, type Workbook } from '..';

const exemple = () => readFormTemplate(readTableFile('template-formulaire.xlsx', lireExemple('template-formulaire.xlsx')))!;
const sheet = (name: string, rows: string[][]): Sheet => ({ name, rows, merges: [] });
const workbook = (...sheets: Sheet[]): Workbook => ({ sheets, warnings: [] });

describe('template d’exemple', () => {
  const template = exemple();

  it('lit les informations du formulaire, les tasks et le ticket', () => {
    expect(template).toMatchObject({
      name: 'Demande sur un dossier',
      description: 'Signaler un problème sur un dossier',
      ticketType: 'Request',
      keywords: ['dossier', 'document', 'adresse'],
      assignmentGroup: 'Service P',
      summary: 'Demande sur le dossier {N° de dossier}',
    });
    expect(template.tasks).toEqual([
      { n: 1, description: 'Fournir le document', group: 'Groupe A', sequence: '1' },
      { n: 2, description: 'Fournir le document', group: 'Groupe B', sequence: '2' },
    ]);
    // Le seul point à vérifier : le rappel de longueurs, retiré du formulaire.
    expect(template.warnings.map(({ level, cell }) => [level, cell])).toEqual([['info', 'I3']]);
  });

  it('lit chaque question avec son type et ce qu’elle demande', () => {
    expect(template.questions.map(({ n, type, mandatory }) => [n, type, mandatory])).toEqual([
      [1, 'label', true],
      [2, 'select', true],
      [3, 'yesno', true],
      [4, 'label', true],
      [5, 'checkbox', true],
      [6, 'multiline', true],
      [7, 'label', true],
      [8, 'label', true],
      [9, 'attachment', true],
      [10, 'attachment', true],
      [11, 'attachment', false],
      [12, 'date', false],
      [13, 'text', true],
      [14, 'checkbox', true],
      [15, 'label', false],
      [16, 'attachment', true],
      [17, 'attachment', true],
      [18, 'label', false],
      [19, 'attachment', true],
    ]);
    const [coordonnees, situation, , , changement, adresse, , , domicile, , , date] = template.questions;
    expect(coordonnees.fields).toEqual(['N° de dossier', 'Nom du demandeur', 'Prénom du demandeur', 'Téléphone']);
    expect(situation.options).toEqual(['Cas 1', 'Cas 2', 'Cas 3', 'Cas 4', 'Cas 5', 'Cas 6']);
    expect(situation.help).toBe('Choisissez la situation qui correspond à votre demande');
    expect(changement.options).toEqual(["MOTIF 1 : Changement d'adresse", 'MOTIF 2 : Changement de contact']);
    expect(adresse.example).toBe('12 rue des Lilas, 75000 Ville');
    expect(domicile.label).toBe('Justificatif de domicile');
    expect(date.cell).toBe('K3');
  });

  it('lit les conditions, dans leur ligne ou dans l’intitulé', () => {
    const conditions = template.questions.map((question) => question.conditions);
    expect(conditions[3]).toEqual([{ question: 3, equals: 'Non' }]);
    expect(conditions[5]).toEqual([{ question: 5, equals: "MOTIF 1 : Changement d'adresse" }]);
    expect(conditions[6]).toEqual([{ question: 5, equals: 'MOTIF 2 : Changement de contact' }]);
    expect(conditions[12]).toEqual([{ question: 2, equals: 'Cas 3' }]);
    expect(template.questions[12].conditionText).toBe('Si Question 2 = Cas 3');
  });

  it('affiche une question selon les réponses données', () => {
    const [, , , signataire, , adresse, , , , , , , commande] = template.questions;
    expect(isQuestionVisible(signataire, new Map())).toBe(false);
    expect(isQuestionVisible(signataire, new Map([[3, 'Non']]))).toBe(true);
    expect(isQuestionVisible(signataire, new Map([[3, 'Oui']]))).toBe(false);
    expect(isQuestionVisible(adresse, new Map([[5, ['MOTIF 2 : Changement de contact']]]))).toBe(false);
    expect(isQuestionVisible(adresse, new Map([[5, ["MOTIF 1 : Changement d'adresse", 'MOTIF 2 : Changement de contact']]]))).toBe(true);
    expect(isQuestionVisible(commande, new Map([[2, 'Cas 3']]))).toBe(true);
    expect(isQuestionVisible(template.questions[0], new Map())).toBe(true);
  });
});

describe('règles de lecture', () => {
  const template = exemple();
  const byLabel = (label: string) => template.questions.find((question) => question.label === label)!;

  it('sépare « Nom / Prénom » en deux champs', () => {
    expect(byLabel('MOTIF 2 : Indiquer le nouveau contact').fields).toEqual(['Nom du contact', 'Prénom du contact', 'Téléphone', 'Email']);
  });

  it('retire le rappel de longueurs du formulaire et l’applique aux champs du même nom', () => {
    const contact = byLabel('MOTIF 2 : Indiquer le nouveau contact');
    expect(contact.limits).toEqual({ 'Nom du contact': 40, Téléphone: 15 });
    expect(template.warnings[0].message).toContain('Rappel pour l’équipe, retiré du formulaire');
  });

  it('fait une pièce jointe par document, facultative quand le document ne sert que dans un cas', () => {
    expect(byLabel('Joindre le justificatif').type).toBe('label');
    expect(template.questions.slice(8, 11).map(({ label, type, mandatory }) => [label, type, mandatory])).toEqual([
      ['Justificatif de domicile', 'attachment', true],
      ["Pièce d'identité", 'attachment', true],
      ["Attestation de l'employeur uniquement en cas de mutation", 'attachment', false],
    ]);
  });

  it('ajoute un titre et une pièce jointe par document pour chaque choix, affichés quand ce choix est coché', () => {
    const lien = byLabel("MOTIF 2 : Quel est le lien avec l'ancien contact ?");
    expect(lien.options).toEqual(['Même service', 'Service repris', 'Fusion de services', 'Autre (préciser)']);
    const after = template.questions.slice(lien.n, lien.n + 5);
    expect(after.map(({ label, type, mandatory }) => [label, type, mandatory])).toEqual([
      ['Documents à fournir : Service repris', 'label', false],
      ['Acte de reprise', 'attachment', true],
      ["Attestation sur l'honneur", 'attachment', true],
      ['Documents à fournir : Fusion de services', 'label', false],
      ['Procès-verbal de fusion', 'attachment', true],
    ]);
    const acte = after[1];
    expect(acte.conditions).toEqual([
      { question: 5, equals: 'MOTIF 2 : Changement de contact' },
      { question: lien.n, equals: 'Service repris' },
    ]);
    const motif2 = ['MOTIF 2 : Changement de contact'];
    expect(isQuestionVisible(acte, new Map<number, string[]>([[5, motif2], [lien.n, ['Même service']]]))).toBe(false);
    expect(isQuestionVisible(acte, new Map<number, string[]>([[5, motif2], [lien.n, ['Service repris']]]))).toBe(true);
  });
});

describe('cas particuliers', () => {
  const questions = (rows: string[][]) => readFormTemplate(workbook(sheet('3 - Questions', rows)))!;

  it('suit « Si OUI » et « X = NON » vers la question oui / non précédente', () => {
    const template = questions([
      ['', 'Question 1', 'Question 2', 'Question 3', 'Question 4'],
      ['Nom de la question', 'Changement de motif ?', "S'agit-il d'une reprise ?", 'Reprise = OUI. Joindre le contrat', 'Si NON : préciser'],
      ['Format', 'Case à cocher', 'Oui/Non', 'Pièce jointe', 'Texte sur une ligne'],
    ]);
    expect(template.questions.map((question) => question.conditions)).toEqual([
      [],
      [],
      [{ question: 2, equals: 'Oui' }],
      [{ question: 2, equals: 'Non' }],
    ]);
  });

  it('lit aussi une question sans titre de colonne, et une ligne par question', () => {
    const colonnes = questions([
      ['', 'Question 1', ''],
      ['Nom de la question', 'Nom', 'Email'],
      ['Format', 'Texte sur une ligne', 'Email'],
    ]);
    expect(colonnes.questions.map((question) => [question.label, question.type])).toEqual([
      ['Nom', 'text'],
      ['Email', 'email'],
    ]);
    const lignes = questions([
      ['Question', 'Type', 'Obligatoire', 'Valeurs', "Texte d'aide"],
      ['Situation', 'Menu déroulant', 'Oui', 'Cas 1, Cas 2', 'Choisissez'],
      ['Description', 'Texte long', 'Non', '', ''],
    ]);
    expect(lignes.questions.map(({ label, type, mandatory, options, help }) => ({ label, type, mandatory, options, help }))).toEqual([
      { label: 'Situation', type: 'select', mandatory: true, options: ['Cas 1', 'Cas 2'], help: 'Choisissez' },
      { label: 'Description', type: 'text', mandatory: false, options: [], help: null },
    ]);
  });

  it('avertit sur un format inconnu, un menu sans choix, une condition non comprise', () => {
    const template = questions([
      ['', 'Question 1', 'Question 2', 'Question 3', 'Question 4'],
      ['Nom de la question', 'Signature', 'Choix', 'MOTIF 9 : détail', 'Précision'],
      ['Format', 'Dessin', 'Menu déroulant', 'Texte sur une ligne', 'Texte sur une ligne'],
      ['Conditions', '', '', '', 'Seulement pour les clients importants'],
    ]);
    expect(template.warnings.map(({ level, message, cell }) => [level, message, cell])).toEqual([
      ['orange', 'Format « Dessin » inconnu : affiché comme un texte.', 'B2'],
      ['orange', 'Menu déroulant « Choix » sans choix.', 'C2'],
      ['orange', 'Condition de l’intitulé sans question correspondante : « MOTIF 9 : détail ».', 'D2'],
      ['orange', 'Condition non comprise : « Seulement pour les clients importants ».', 'E2'],
    ]);
    expect(template.warnings[3].question).toBe('Quand cette question doit-elle s’afficher ?');
  });

  it('dit quand le template est encore vide, et ignore un classeur sans questions', () => {
    const vide = questions([['', 'Instructions', 'Question 1', 'Question 2'], ['Nom de la question', 'Nom du champ']]);
    expect(vide.questions).toEqual([]);
    expect(vide.warnings[0].message).toBe('Aucune question remplie : le template est encore vide.');
    expect(readFormTemplate(workbook(sheet('Feuil1', [['a']])))).toBeNull();
  });

  it('reconnaît les formats en français et en anglais', () => {
    expect(
      ['Menu déroulant', 'Select Box', 'Oui/Non', 'Yes/No', 'Date et heure', 'Liste', 'Libellé au format RTF', 'Contenant Début', 'Échelle numérique', 'Multi Line Text', 'Adresse IP'].map(questionType),
    ).toEqual(['select', 'select', 'yesno', 'yesno', 'datetime', 'list', 'richlabel', 'container', 'scale', 'multiline', 'ip']);
    expect(questionType('')).toBeNull();
  });
});
