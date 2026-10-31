/**
 * Règles de lecture apprises du compte connecté : une ligne par compte dans la
 * table `public.reading_rules` (voir supabase/migrations/). Les règles de
 * sécurité de la base (RLS) limitent chaque requête à la ligne du compte.
 */

import { parseRules, type ReadingRule } from '@/import';

import { supabase } from './client';

const TABLE = 'reading_rules';

/** Les règles du compte ; une liste vide s'il n'en a encore aucune. */
export async function getCloudRules(): Promise<ReadingRule[]> {
  const { data, error } = await supabase.from(TABLE).select('rules').maybeSingle();
  if (error) throw new Error(error.message);
  return parseRules(data?.rules);
}

/** Remplace les règles du compte (crée sa ligne la première fois). */
export async function saveCloudRules(rules: ReadingRule[]): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Connexion requise.');
  const { error } = await supabase.from(TABLE).upsert({ owner_id: auth.user.id, rules });
  if (error) throw new Error(error.message);
}
