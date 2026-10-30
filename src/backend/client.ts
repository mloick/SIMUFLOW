/**
 * Client Supabase partagé par toute l'app.
 *
 * La session (le jeton de connexion) est gardée dans `localStorage`, que
 * expo-sqlite fournit sur iOS et Android (le navigateur l'a déjà sur le web) :
 * on reste connecté d'un lancement à l'autre.
 */

import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Pas de lien de connexion à lire dans une URL de page web.
    detectSessionInUrl: false,
  },
});
