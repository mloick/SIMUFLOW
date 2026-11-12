import { describe, expect, it, jest } from '@jest/globals';

import {
  getSavedForm,
  getShownForm,
  linkWorkflow,
  getSavedForms,
  hasPendingForms,
  parseSavedForms,
  reconcileForms,
  removeSavedForm,
  forgetCloudForms,
  syncSavedForms,
  type SavedForm,
  saveForm,
  showSavedForm,
  updateSavedForm,
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

const saved = (id: string, updatedAt: string, extra: Partial<SavedForm> = {}): SavedForm => ({
  id,
  form,
  source: `${id}.xlsx`,
  savedAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
  workflow: null,
  ...extra,
});

describe('formulaires sur le compte', () => {
  it('accorde le téléphone et le compte, formulaire par formulaire', () => {
    const server = [saved('a', '2026-11-10'), saved('b', '2026-11-12', { source: 'serveur' }), saved('c', '2026-11-01'), saved('d', '2026-11-01')];
    const local = [
      saved('b', '2026-11-11', { cloud: true }), // plus ancien ici : le compte gagne
      saved('a', '2026-11-11', { cloud: true, source: 'téléphone' }), // plus récent ici : le téléphone gagne
      saved('e', '2026-11-12'), // nouveau : il part au compte
      saved('f', '2026-11-01', { cloud: true }), // retiré sur un autre appareil
    ];
    const result = reconcileForms(server, local, ['d']);
    expect(result.map((one) => [one.id, one.source])).toEqual([
      ['c', 'c.xlsx'],
      ['b', 'serveur'],
      ['a', 'téléphone'],
      ['e', 'e.xlsx'],
    ]);
    expect(result.every((one) => one.cloud)).toBe(true);
  });

  it('envoie un formulaire gardé, reçoit ceux du compte, puis les oublie à la déconnexion', async () => {
    getSavedForms().forEach((one) => removeSavedForm(one.id));
    const id = saveForm(form, 'local.xlsx', null, new Date(2026, 10, 13));
    expect(hasPendingForms()).toBe(true);
    const save = jest.fn(async (_forms: SavedForm[]) => {});
    await syncSavedForms({ get: async () => [saved('distant', '2026-11-12')], save });
    const sent = save.mock.calls[0][0];
    expect(sent.map((one) => one.id)).toEqual(['distant', id]);
    expect(sent.some((one) => 'cloud' in one)).toBe(false);
    expect(hasPendingForms()).toBe(false);
    expect(getSavedForms().map((one) => one.id)).toEqual(['distant', id]);

    // Modifié ici, il repart ; rien ne repart quand rien n'a changé.
    updateSavedForm(id, { ...form, name: 'Demande modifiée' });
    expect(hasPendingForms()).toBe(true);
    const again = jest.fn(async (_forms: SavedForm[]) => {});
    await syncSavedForms({ get: async () => sent, save: again });
    expect(again.mock.calls[0][0].find((one) => one.id === id)?.form.name).toBe('Demande modifiée');
    const quiet = jest.fn(async (_forms: SavedForm[]) => {});
    await syncSavedForms({ get: async () => again.mock.calls[0][0], save: quiet });
    expect(quiet).not.toHaveBeenCalled();

    // Retiré ici : il est aussi retiré du compte.
    removeSavedForm('distant');
    const removal = jest.fn(async (_forms: SavedForm[]) => {});
    await syncSavedForms({ get: async () => again.mock.calls[0][0], save: removal });
    expect(removal.mock.calls[0][0].map((one) => one.id)).toEqual([id]);

    forgetCloudForms();
    expect(getSavedForms()).toEqual([]);
  });
});
