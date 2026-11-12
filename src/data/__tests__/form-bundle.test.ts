import { describe, expect, it, jest } from '@jest/globals';

import { readFormBundle } from '@/data/form-chain';

jest.mock('@/data/tracking-store', () => ({ saveTracking: () => undefined }));
jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: () => undefined }));
jest.mock('@/utils/read-file', () => ({
  readPickedBytes: async (asset: { name: string }) => jest.requireActual<{ lireExemple: (name: string) => Uint8Array }>('../../../jest/lire-exemple').lireExemple(asset.name),
  readPickedFile: async (asset: { name: string }) =>
    new TextDecoder().decode(
      jest.requireActual<{ lireExemple: (name: string) => Uint8Array }>('../../../jest/lire-exemple').lireExemple(asset.name),
    ),
}));

const file = (name: string) => ({ name, uri: name, lastModified: 0 }) as never;

describe('readFormBundle', () => {
  it('lit un formulaire et son workflow venus de deux fichiers, dans n’importe quel ordre', async () => {
    const bundle = await readFormBundle([file('workflow-sla-ola.xlsx'), file('template-formulaire.xlsx')]);
    expect(bundle.source).toBe('template-formulaire.xlsx');
    expect(bundle.workflow?.kind).toBe('situations');
    expect(bundle.workflow?.source).toBe('workflow-sla-ola.xlsx');
  });

  it('lit un classeur qui contient les deux', async () => {
    const bundle = await readFormBundle([file('formulaire-et-workflow.xlsx')]);
    expect(bundle.workflow?.kind).toBe('situations');
  });

  it('garde un formulaire seul sans workflow', async () => {
    const bundle = await readFormBundle([file('template-formulaire.xlsx')]);
    expect(bundle.workflow).toBeNull();
  });

  it('accepte un schéma draw.io comme workflow', async () => {
    const bundle = await readFormBundle([file('template-formulaire.xlsx'), file('validation-facture.drawio')]);
    expect(bundle.workflow?.kind).toBe('process');
  });

  it('refuse des fichiers sans template de formulaire', async () => {
    await expect(readFormBundle([file('workflow-sla-ola.xlsx')])).rejects.toThrow('template de formulaire');
  });
});
