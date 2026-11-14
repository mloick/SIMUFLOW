/**
 * Profil du compte connecté sur le serveur : une ligne dans `public.profiles`
 * (voir supabase/migrations/20261116000000_profils.sql). Les règles de
 * sécurité (RLS) limitent chaque requête au profil du compte.
 */

import type { Profile, ProfileRole } from '@/domain';

import { supabase } from './client';

const TABLE = 'profiles';

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: ProfileRole | null;
};

/** Erreur d'enregistrement du profil, avec un message prêt à afficher. */
export class ProfileError extends Error {
  /** L'identifiant est déjà pris par un autre compte. */
  readonly taken: boolean;
  constructor(message: string, taken = false) {
    super(message);
    this.name = 'ProfileError';
    this.taken = taken;
  }
}

function fromRow(row: ProfileRow): Profile {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    ...(row.role ? { role: row.role } : {}),
  };
}

/** Message pour une erreur de la base (code PostgreSQL ou PostgREST). */
export function profileErrorMessage(error: { code?: string; message?: string }): ProfileError {
  if (error.code === '23505') return new ProfileError('Cet identifiant est déjà pris : choisissez-en un autre.', true);
  if (error.code === '42P01' || error.code === 'PGRST205')
    return new ProfileError('Le serveur n’a pas encore la table des profils : le script SQL est à appliquer.');
  if (error.code === '23514')
    return new ProfileError('Une valeur n’est pas acceptée par le serveur : vérifiez les champs.');
  return new ProfileError('Le profil n’a pas pu être enregistré. Vérifiez la connexion et réessayez.');
}

/** Le profil du compte connecté, ou null s'il n'en a pas encore. */
export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from(TABLE).select('id, first_name, last_name, username, role').maybeSingle();
  if (error) throw profileErrorMessage(error);
  return data ? fromRow(data as ProfileRow) : null;
}

/** Crée ou remplace le profil du compte connecté. */
export async function saveMyProfile(profile: Profile): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ProfileError('Connexion requise.');
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({
      id: auth.user.id,
      first_name: profile.firstName.trim(),
      last_name: profile.lastName.trim(),
      username: profile.username,
      role: profile.role ?? null,
    })
    .select('id, first_name, last_name, username, role')
    .single();
  if (error) throw profileErrorMessage(error);
  return fromRow(data as ProfileRow);
}
