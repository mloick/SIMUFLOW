/**
 * Client Supabase partagé par toute l'app.
 *
 * La session (le jeton de connexion) est gardée dans le trousseau chiffré du
 * téléphone (secure-session-storage.ts) : on reste connecté d'un lancement à l'autre.
 */

import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import { secureSessionStorage } from './secure-session-storage';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureSessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Pas de lien de connexion à lire dans une URL de page web.
    detectSessionInUrl: false,
  },
});

// Le jeton de connexion expire au bout d'une heure : Supabase le renouvelle
// tant que l'app est au premier plan, et s'arrête quand elle passe en arrière-plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
