/**
 * Où Supabase garde la session (le jeton de connexion).
 *
 * Sur iOS et Android : dans le trousseau chiffré du téléphone (expo-secure-store :
 * Keychain sur iOS, clé du Keystore sur Android), réservé à ce téléphone (jamais
 * copié dans une sauvegarde). Une session gardée par une ancienne version de l'app
 * dans `localStorage` (base SQLite, non chiffrée) y est déplacée à la première
 * lecture, puis effacée : personne n'est déconnecté par la mise à jour.
 *
 * Écrit sans dépendre des vrais modules pour pouvoir le tester.
 */

/** Ce que Supabase attend pour garder sa session. */
export type SessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Le trousseau chiffré (expo-secure-store en vrai). */
export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** L'ancien emplacement, non chiffré (`localStorage` en vrai). */
export type LegacyStorageLike = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
};

export function createSessionStorage(secure: SecureStoreLike, legacy?: LegacyStorageLike): SessionStorage {
  return {
    async getItem(key) {
      const value = await secure.getItemAsync(key);
      if (value !== null || !legacy) return value;
      // Ancienne session non chiffrée : on la déplace dans le trousseau.
      const old = legacy.getItem(key);
      if (old === null) return null;
      await secure.setItemAsync(key, old);
      legacy.removeItem(key);
      return old;
    },
    setItem: (key, value) => secure.setItemAsync(key, value),
    async removeItem(key) {
      await secure.deleteItemAsync(key);
      legacy?.removeItem(key);
    },
  };
}
