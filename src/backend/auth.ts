/**
 * Compte SimuFlow : connexion, création de compte, déconnexion (Supabase Auth,
 * par adresse e-mail et mot de passe).
 */

import { useSyncExternalStore } from 'react';

import { authErrorMessage, type Credentials } from './auth-messages';
import { supabase } from './client';
import { createSessionStore, type SessionState } from './session-store';

const store = createSessionStore(supabase.auth);

/** La session en cours : `null` si personne n'est connecté, `undefined` pendant la lecture. */
export function useSession(): SessionState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Résultat d'une action : `ok`, ou le message d'erreur à afficher. */
export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string };

export async function signIn({ email, password }: Credentials): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}

export async function signUp({ email, password }: Credentials): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: authErrorMessage(error) };
  // Adresse déjà inscrite, confirmation par e-mail active : Supabase ne le dit
  // pas (pour ne pas révéler qui a un compte) et renvoie un compte sans identité.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, message: authErrorMessage({ code: 'user_already_exists' }) };
  }
  // Pas de session : il faut d'abord cliquer le lien reçu par e-mail.
  return { ok: true, needsConfirmation: !data.session };
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}
