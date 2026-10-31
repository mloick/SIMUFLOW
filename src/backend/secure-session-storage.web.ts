import type { SessionStorage } from './session-storage';

/**
 * Sur le web (aperçu de développement seulement), pas de trousseau : la session
 * reste dans le `localStorage` du navigateur. Absent pendant le rendu côté serveur.
 */
export const secureSessionStorage: SessionStorage | undefined =
  typeof localStorage === 'undefined'
    ? undefined
    : {
        getItem: async (key) => localStorage.getItem(key),
        setItem: async (key, value) => localStorage.setItem(key, value),
        removeItem: async (key) => localStorage.removeItem(key),
      };
