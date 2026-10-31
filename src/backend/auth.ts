/**
 * Compte SimuFlow : connexion, création de compte, déconnexion, suppression (Supabase Auth,
 * par adresse e-mail et mot de passe).
 */

import { useSyncExternalStore } from 'react';

import { authErrorMessage, cleanCode, type Credentials, type PasswordReset } from './auth-messages';
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

/**
 * Mot de passe oublié, étape 1 : Supabase envoie un e-mail avec un code à 6 chiffres
 * (modèle « Reset password » du projet, qui doit contenir {{ .Token }}).
 * Pour ne pas révéler qui a un compte, la réponse est la même que l'adresse existe ou non.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}

/**
 * Mot de passe oublié, étape 2 : le code vérifié ouvre une session sur le compte,
 * puis le nouveau mot de passe remplace l'ancien. On reste connecté.
 */
export async function resetPassword({ email, code, password }: PasswordReset): Promise<AuthResult> {
  const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: cleanCode(code), type: 'recovery' });
  if (verified.error) return { ok: false, message: authErrorMessage(verified.error) };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
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
