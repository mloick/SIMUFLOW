/**
 * Compte SimuFlow : connexion, création de compte, déconnexion, suppression (Supabase Auth,
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

/**
 * Supprime le compte connecté et tous ses process, par la fonction SQL
 * `delete_my_account` (voir supabase/migrations/), puis oublie la session.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    // En développement, le détail (code et message du serveur) s'affiche dans le terminal de Metro.
    if (__DEV__) console.warn('Suppression du compte refusée :', error.code, error.message);
    // Erreur de réseau : le client renvoie un message « Failed to fetch » / « Network request failed ».
    const offline = /fetch|network/i.test(error.message);
    return {
      ok: false,
      message: offline ? authErrorMessage({ status: 0 }) : 'La suppression a échoué. Réessayez plus tard.',
    };
  }
  // Le compte n'existe plus côté serveur : on efface seulement la session du téléphone.
  await supabase.auth.signOut({ scope: 'local' });
  return { ok: true };
}
