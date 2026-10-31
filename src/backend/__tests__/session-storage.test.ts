import { describe, expect, it } from '@jest/globals';

import { createSessionStorage, type LegacyStorageLike, type SecureStoreLike } from '../session-storage';

/** Un trousseau et un ancien stockage en mémoire, pour regarder ce qui y est écrit. */
function fakes(secureData: Record<string, string> = {}, legacyData: Record<string, string> = {}) {
  const secure: SecureStoreLike = {
    getItemAsync: async (key) => secureData[key] ?? null,
    setItemAsync: async (key, value) => {
      secureData[key] = value;
    },
    deleteItemAsync: async (key) => {
      delete secureData[key];
    },
  };
  const legacy: LegacyStorageLike = {
    getItem: (key) => legacyData[key] ?? null,
    removeItem: (key) => {
      delete legacyData[key];
    },
  };
  return { secure, legacy, secureData, legacyData };
}

describe('createSessionStorage', () => {
  it('écrit et relit la session dans le trousseau', async () => {
    const { secure, legacy, secureData, legacyData } = fakes();
    const storage = createSessionStorage(secure, legacy);
    await storage.setItem('session', 'jeton');
    expect(await storage.getItem('session')).toBe('jeton');
    expect(secureData).toEqual({ session: 'jeton' });
    expect(legacyData).toEqual({});
  });

  it('déplace une ancienne session non chiffrée dans le trousseau, puis l’efface', async () => {
    const { secure, legacy, secureData, legacyData } = fakes({}, { session: 'ancien-jeton', autre: 'garde' });
    const storage = createSessionStorage(secure, legacy);
    expect(await storage.getItem('session')).toBe('ancien-jeton');
    expect(secureData).toEqual({ session: 'ancien-jeton' });
    expect(legacyData).toEqual({ autre: 'garde' });
  });

  it('préfère le trousseau à l’ancien emplacement', async () => {
    const { secure, legacy } = fakes({ session: 'nouveau' }, { session: 'ancien' });
    expect(await createSessionStorage(secure, legacy).getItem('session')).toBe('nouveau');
  });

  it('efface la session des deux emplacements à la déconnexion', async () => {
    const { secure, legacy, secureData, legacyData } = fakes({ session: 'a' }, { session: 'b' });
    await createSessionStorage(secure, legacy).removeItem('session');
    expect(secureData).toEqual({});
    expect(legacyData).toEqual({});
  });

  it('répond null quand il n’y a pas de session', async () => {
    const { secure, legacy } = fakes();
    expect(await createSessionStorage(secure, legacy).getItem('session')).toBeNull();
  });
});
