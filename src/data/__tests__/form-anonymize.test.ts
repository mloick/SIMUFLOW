import { describe, expect, it, jest } from '@jest/globals';

import { anonymizeForm, formActors } from '@/data/form-anonymize';
import { anonymizeShown, getShownForm, showForm, type LinkedWorkflow } from '@/data/form-store';
import { findFormLink, readFormTemplate, readTableFile, workbookToSituations } from '@/import/tableau';

import { lireExemple } from '../../../jest/lire-exemple';

jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: jest.fn() }));

const workbook = readTableFile('formulaire-et-workflow.xlsx', lireExemple('formulaire-et-workflow.xlsx'));
const form = readFormTemplate(workbook)!;
const workflow: LinkedWorkflow = { kind: 'situations', source: 'formulaire-et-workflow.xlsx', ...workbookToSituations(workbook) };

describe('anonymizeForm', () => {
  const actors = formActors(form, workflow);
  const result = anonymizeForm(form, workflow, ['Famille X']);
  const text = JSON.stringify(result);

  it('renomme chaque groupe du formulaire et du workflow, et masque les mots choisis', () => {
    expect(actors.length).toBeGreaterThan(1);
    expect(result.actorCount).toBe(actors.length);
    actors.forEach((actor) => expect(text).not.toContain(`"${actor}"`));
    expect(text).toContain('"Service A"');
    expect(text).not.toContain('Famille X');
    expect(text).toContain('[masqué]');
  });

  it('garde le lien entre le choix du formulaire et les situations', () => {
    const before = findFormLink(form, workflow.kind === 'situations' ? workflow.situations : []);
    const after = findFormLink(result.form, result.workflow?.kind === 'situations' ? result.workflow.situations : []);
    expect(after?.linked).toBe(before?.linked);
    expect(after?.question.n).toBe(before?.question.n);
  });

  it('garde la forme du formulaire', () => {
    expect(result.form.questions.map((q) => [q.n, q.type, q.mandatory, q.cell, q.conditions.length])).toEqual(
      form.questions.map((q) => [q.n, q.type, q.mandatory, q.cell, q.conditions.length]),
    );
  });
});

describe('anonymizeShown', () => {
  it('anonymise le formulaire affiché, puis rend la version d’origine', () => {
    showForm(form, { source: 'Famille X.xlsx', workflow });
    anonymizeShown(['Famille X']);
    expect(getShownForm()?.anonymous?.actorCount).toBe(formActors(form, workflow).length);
    expect(getShownForm()?.source).toBe('[masqué].xlsx');
    anonymizeShown(null);
    expect(getShownForm()).toMatchObject({ form, workflow, source: 'Famille X.xlsx', anonymous: undefined });
  });
});
