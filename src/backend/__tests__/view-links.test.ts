import { describe, expect, it, jest } from '@jest/globals';

import type { LinkedWorkflow } from '@/data/form-store';
import type { Process } from '@/domain';
import type { FormTemplate } from '@/import/tableau';

import { openViewLink, processWorkflow, readViewContent, viewContentOf, viewLinkErrorMessage, viewLinkUrl } from '../view-links';

const mockRpc = jest.fn(async (_name: string, _args: object): Promise<{ data: unknown; error: unknown }> => ({ data: [], error: null }));
jest.mock('../client', () => ({ supabase: { rpc: (name: string, args: object) => mockRpc(name, args) } }));

const form: FormTemplate = {
  name: 'Demande de matériel',
  description: null,
  ticketType: null,
  keywords: [],
  questions: [],
  tasks: [],
  assignmentGroup: null,
  summary: null,
  warnings: [{ sheet: 'Formulaire', row: 3, message: 'Ligne ignorée' } as unknown as FormTemplate['warnings'][number]],
};

const process: Process = {
  id: 'p1',
  name: 'Accueil d’un arrivant',
  source: 'drawio',
  projectId: 'projet-1',
  editedAt: '2026-11-20T10:00:00Z',
  steps: [
    { id: 's1', kind: 'start', title: 'Arrivée' },
    { id: 's2', kind: 'end', title: 'Poste prêt' },
  ],
  links: [{ from: 's1', to: 's2' }],
} as Process;

describe('liens de consultation', () => {
  it('donne l’adresse de la page dans la version web', () => {
    expect(viewLinkUrl('abc')).toBe('https://mloick.github.io/SIMUFLOW/app/voir/abc');
  });

  it('choisit la sorte du lien selon ce qu’on montre', () => {
    const workflow = processWorkflow(process);
    expect(viewContentOf(form, null)?.kind).toBe('form');
    expect(viewContentOf(null, workflow)?.kind).toBe('workflow');
    expect(viewContentOf(form, workflow)?.kind).toBe('form_workflow');
    expect(viewContentOf(null, null)).toBeNull();
  });

  it('ne garde dans la copie ni les avertissements, ni le projet, ni la date de correction', () => {
    const built = viewContentOf(form, processWorkflow(process))!;
    expect(built.content.form?.warnings).toEqual([]);
    const copied = built.content.workflow as Extract<LinkedWorkflow, { kind: 'process' }>;
    expect(copied.process.projectId).toBeUndefined();
    expect(copied.process.editedAt).toBeUndefined();
    expect(copied.process.steps).toHaveLength(2);
    // L'original n'est pas touché.
    expect(process.projectId).toBe('projet-1');
  });

  it('relit une copie qui correspond à sa sorte, refuse les autres', () => {
    const { content } = viewContentOf(form, processWorkflow(process))!;
    expect(readViewContent('form_workflow', content)?.form?.name).toBe('Demande de matériel');
    expect(readViewContent('form', { form: { questions: [] } })?.workflow).toBeNull();
    expect(readViewContent('workflow', { workflow: { kind: 'situations', source: 'a.xlsx', situations: [] } })?.form).toBeNull();
    expect(readViewContent('form_workflow', { form: { questions: [] } })).toBeNull();
    expect(readViewContent('workflow', { workflow: { kind: 'process', process: { steps: [] } } })).toBeNull();
    expect(readViewContent('autre', content)).toBeNull();
    expect(readViewContent('form', null)).toBeNull();
  });

  it('ouvre un lien par son jeton, avec le nom de qui l’envoie', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          kind: 'form',
          title: 'Demande de matériel',
          content: { form: { questions: [] } },
          note: 'Essayez de le remplir',
          expires_at: '2026-12-26T10:00:00Z',
          owner_first_name: 'Inès',
          owner_last_name: 'Moreau',
          owner_username: 'ines.moreau',
        },
      ],
      error: null,
    });
    const view = await openViewLink('jeton');
    expect(mockRpc).toHaveBeenLastCalledWith('view_link_open', { p_token: 'jeton' });
    expect(view).toMatchObject({ kind: 'form', title: 'Demande de matériel', note: 'Essayez de le remplir', ownerName: 'Inès Moreau' });
    expect(view.form?.warnings).toEqual([]);
  });

  it('dit pourquoi un lien ne s’ouvre pas', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'SF410' } });
    await expect(openViewLink('jeton')).rejects.toThrow('Ce lien a expiré');
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002' } });
    await expect(openViewLink('jeton')).rejects.toThrow('n’existe pas ou a été retiré');
    mockRpc.mockResolvedValueOnce({ data: [{ kind: 'form', title: 'X', content: {}, note: null, expires_at: '' }], error: null });
    await expect(openViewLink('jeton')).rejects.toThrow('ne peut pas s’afficher');
    expect(viewLinkErrorMessage({ code: 'SF429' }).message).toContain('100 liens');
    expect(viewLinkErrorMessage({ code: 'PGRST205' }).message).toContain('script SQL');
  });
});
