import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { importProcessFile } from '@/import';

import accueil from '../../../docs/exemples/accueil-arrivant.json';

// Le fichier du téléphone est remplacé par une variable.
let mockSaved: string | null = null;
jest.mock('../saved-file', () => ({
  readSaved: () => mockSaved,
  writeSaved: (text: string) => {
    mockSaved = text;
  },
}));

type Store = typeof import('../process-store');
const loadStore = () => {
  let store!: Store;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- relire le module comme au démarrage
    store = require('../process-store');
  });
  return store;
};

const exemple = () => importProcessFile('accueil-arrivant.json', JSON.stringify(accueil), 'import-1').processes[0];

describe('process importés', () => {
  beforeEach(() => {
    mockSaved = null;
  });

  it('retrouve un process importé par son identifiant', () => {
    const store = loadStore();
    store.addImportedProcess(exemple());
    expect(store.getProcess('import-1-1')?.name).toBe('Accueil d’un nouvel arrivant');
    expect(store.isImported('import-1-1')).toBe(true);
    expect(store.isImported('demande-acces')).toBe(false);
  });

  it('les relit après un redémarrage de l’app', () => {
    loadStore().addImportedProcess(exemple());
    const relu = loadStore();
    expect(relu.getProcess('import-1-1')?.steps).toHaveLength(6);
  });

  it('enregistre aussi la suppression', () => {
    const store = loadStore();
    store.addImportedProcess(exemple());
    store.removeImportedProcess('import-1-1');
    expect(loadStore().getProcess('import-1-1')).toBeUndefined();
  });

  it('ignore un fichier abîmé ou d’un autre format', () => {
    const { parseSaved } = loadStore();
    expect(parseSaved('{pas du json')).toEqual([]);
    expect(parseSaved('{"format":"autre","processes":[]}')).toEqual([]);
    expect(parseSaved(JSON.stringify({ format: 'simuflow-imports', processes: [exemple(), { id: 3 }] }))).toHaveLength(
      1,
    );
  });
});

describe('process importés et serveur', () => {
  beforeEach(() => {
    mockSaved = null;
  });

  it('relit un fichier de la version 1 (liste de process)', () => {
    const { parseSaved } = loadStore();
    const entries = parseSaved(JSON.stringify({ format: 'simuflow-imports', version: 1, processes: [exemple()] }));
    expect(entries).toEqual([{ process: exemple() }]);
  });

  it('garde un process déjà envoyé marqué « à supprimer », et le cache', () => {
    const store = loadStore();
    store.setImportEntries([{ process: exemple(), cloudId: 'serveur-1' }]);
    expect(store.isInCloud('import-1-1')).toBe(true);
    store.removeImportedProcess('import-1-1');
    expect(store.getProcess('import-1-1')).toBeUndefined();
    expect(store.getImportEntries()).toEqual([{ process: exemple(), cloudId: 'serveur-1', deleted: true }]);
    // Et la marque survit au redémarrage.
    expect(loadStore().getImportEntries()[0].deleted).toBe(true);
  });

  it('oublie tout de suite un process qui n’a jamais été envoyé', () => {
    const store = loadStore();
    store.addImportedProcess(exemple());
    store.removeImportedProcess('import-1-1');
    expect(store.getImportEntries()).toEqual([]);
  });
});
