import * as SecureStore from 'expo-secure-store';

import './local-storage';
import { createSessionStorage, type SessionStorage } from './session-storage';

/**
 * Accessible dès le premier déverrouillage après le démarrage du téléphone (le jeton
 * peut être renouvelé app en arrière-plan), et jamais copié vers un autre téléphone.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** La session Supabase dans le trousseau chiffré du téléphone (voir session-storage.ts). */
export const secureSessionStorage: SessionStorage = createSessionStorage(
  {
    getItemAsync: (key) => SecureStore.getItemAsync(key, OPTIONS),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
  },
  localStorage,
);
