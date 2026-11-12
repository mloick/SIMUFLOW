/**
 * Formulaires gardés du compte connecté : une ligne par compte dans la table
 * `public.saved_forms` (voir supabase/migrations/). Les règles de sécurité de
 * la base (RLS) limitent chaque requête à la ligne du compte.
 */

import type { SavedForm } from '@/data/form-store';

import { supabase } from './client';

const TABLE = 'saved_forms';

/** Les formulaires du compte ; une liste vide s'il n'en a encore aucun. */
export async function getCloudForms(): Promise<SavedForm[]> {
  const { data, error } = await supabase.from(TABLE).select('forms').maybeSingle();
  if (error) throw new Error(error.message);
  return Array.isArray(data?.forms) ? (data.forms as SavedForm[]) : [];
}

/** Remplace les formulaires du compte (crée sa ligne la première fois). */
export async function saveCloudForms(forms: SavedForm[]): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Connexion requise.');
  const { error } = await supabase.from(TABLE).upsert({ owner_id: auth.user.id, forms });
  if (error) throw new Error(error.message);
}
