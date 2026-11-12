import { describe, expect, it, jest } from '@jest/globals';

import {
  getSavedForm,
  getShownForm,
  linkWorkflow,
  parseSavedForms,
  removeSavedForm,
  saveForm,
  showSavedForm,
  type LinkedWorkflow,
} from '@/data/form-store';
import type { FormTemplate } from '@/import/tableau';

jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: jest.fn() }));

const form: FormTemplate = {
  name: 'Demande',
  description: null,
  ticketType: null,
  keywords: [],
  questions: [],
  tasks: [],
  assignmentGroup: null,
  summary: null,
  warnings: [],
};
const workflow: LinkedWorkflow = { kind: 'process', source: 'schema.drawio', process: { id: 'p', name: 'P', steps: [], links: [] } };

describe('formulaires gardés', () => {
  it('garde un formulaire, lui lie un workflow, le rouvre puis le retire', () => {
    const id = saveForm(form, 'template.xlsx', null, new Date(2026, 10, 12));
    expect(getSavedForm(id)?.workflow).toBeNull();
    linkWorkflow(id, workflow);
    expect(getSavedForm(id)?.workflow).toEqual(workflow);
    showSavedForm(getSavedForm(id)!);
    expect(getShownForm()).toMatchObject({ savedId: id, key: id, source: 'template.xlsx', workflow });
    removeSavedForm(id);
    expect(getSavedForm(id)).toBeUndefined();
  });

  it('relit le fichier, et ignore un fichier abîmé ou inconnu', () => {
    const text = JSON.stringify({ format: 'simuflow-formulaires', version: 1, forms: [{ id: 'f', form, source: 'a', savedAt: '' }, { id: 3 }] });
    expect(parseSavedForms(text)).toEqual([{ id: 'f', form, source: 'a', savedAt: '', workflow: null }]);
    expect(parseSavedForms('{')).toEqual([]);
    expect(parseSavedForms(JSON.stringify({ format: 'autre', forms: [] }))).toEqual([]);
    expect(parseSavedForms(null)).toEqual([]);
  });
});
