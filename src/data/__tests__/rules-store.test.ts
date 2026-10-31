import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Process } from '@/domain';
import type { ReadingRule } from '@/import';

// Le fichier du téléphone est remplacé par une variable.
let mockSaved: string | null = null;
jest.mock('../saved-file', () => ({
  readSaved: () => mockSaved,
  writeSaved: (text: string) => {
    mockSaved = text;
  },
}));

type Store = typeof import('../rules-store');
const loadStore = () => {
  let store!: Store;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- relire le module comme au démarrage
    store = require('../rules-store');
  });
  return store;
};

const lu: Process = {
  id: 'p',
  name: 'Note de frais',
  steps: [
    { id: 'a', kind: 'task', title: 'Contrôler', shape: 'hexagon', actor: 'Serv. compta' },
    { id: 'b', kind: 'task', title: 'Rembourser', shape: 'rounded', actor: 'Serv. compta' },
  ],
  links: [],
};
const corrige: Process = {
  ...lu,
  steps: [
    { ...lu.steps[0], kind: 'decision', actor: 'Comptabilité' },
    { ...lu.steps[1], actor: 'Comptabilité' },
  ],
};
const surLeCompte: ReadingRule = { type: 'actor', from: 'Achats', to: 'Service achats' };

/** Serveur fictif : une liste de règles, et le nombre d'envois. */
const fakeServer = (rules: ReadingRule[]) => {
  const server = { rules, saves: 0 };
  return {
    server,
    api: {
      get: async () => server.rules,
      save: async (next: ReadingRule[]) => {
        server.rules = next;
        server.saves++;
      },
    },
  };
};

describe('règles de lecture sur le téléphone et le compte', () => {
  beforeEach(() => {
    mockSaved = null;
  });

  it('apprend, garde les règles sur le téléphone et les relit au démarrage', () => {
    expect(loadStore().learnFromCorrection(lu, corrige)).toBe(2);
    const relu = loadStore();
    expect(relu.getReadingRules()).toHaveLength(2);
    expect(relu.hasPendingRules()).toBe(true);
  });

  it('envoie les règles apprises et reprend celles du compte', async () => {
    const store = loadStore();
    store.learnFromCorrection(lu, corrige);
    const { server, api } = fakeServer([surLeCompte]);
    await store.syncReadingRules(api);
    expect(server.saves).toBe(1);
    expect(server.rules).toHaveLength(3);
    expect(store.getReadingRules()).toEqual(server.rules);
    expect(store.hasPendingRules()).toBe(false);
  });

  it('sans changement ici, prend les règles du compte sans rien envoyer', async () => {
    const store = loadStore();
    const { server, api } = fakeServer([surLeCompte]);
    await store.syncReadingRules(api);
    expect(server.saves).toBe(0);
    expect(store.getReadingRules()).toEqual([surLeCompte]);
  });

  it('retire aussi du compte une règle oubliée', async () => {
    const store = loadStore();
    const { server, api } = fakeServer([surLeCompte]);
    await store.syncReadingRules(api);
    store.forgetReadingRule(store.getReadingRules()[0]);
    await store.syncReadingRules(api);
    expect(server.rules).toEqual([]);
  });

  it('à la déconnexion, retire du téléphone les règles du compte mais garde celles pas encore envoyées', async () => {
    const store = loadStore();
    await store.syncReadingRules(fakeServer([surLeCompte]).api);
    store.forgetCloudRules();
    expect(store.getReadingRules()).toEqual([]);
    store.learnFromCorrection(lu, corrige);
    store.forgetCloudRules();
    expect(store.getReadingRules()).toHaveLength(2);
  });

  it('applique les règles à un import', () => {
    const store = loadStore();
    store.learnFromCorrection(lu, corrige);
    const { result, applied } = store.applyReadingRules({ processes: [lu], warnings: [] });
    expect(result.processes[0].steps.map((step) => [step.kind, step.actor])).toEqual([
      ['decision', 'Comptabilité'],
      ['task', 'Comptabilité'],
    ]);
    expect(applied).toHaveLength(2);
  });
});
