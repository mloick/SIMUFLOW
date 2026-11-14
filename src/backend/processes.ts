/**
 * Lecture et écriture des process du compte connecté sur le serveur. Les règles
 * de sécurité de la base (RLS) limitent chaque requête aux process du compte :
 * l'app n'a pas besoin de filtrer par propriétaire.
 */

import type { Process } from '@/domain';

import { supabase } from './client';
import { fromRow, toRow, type ProcessRow } from './process-row';
import { getT } from '@/i18n';

const TABLE = 'processes';

/**
 * Les process du compte connecté, du plus récent au plus ancien. Seulement
 * ceux dont il est propriétaire : les process partagés avec lui sont aussi
 * lisibles (voir 20261117000000_partage.sql), mais ne se synchronisent pas.
 */
export async function listCloudProcesses(): Promise<Process[]> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error(getT().errors.signInRequired);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ProcessRow[]).map(fromRow);
}

/** Enregistre un process sur le serveur ; renvoie sa version serveur (avec son identifiant). */
export async function createCloudProcess(process: Process): Promise<Process> {
  const { data, error } = await supabase.from(TABLE).insert(toRow(process)).select().single();
  if (error) throw new Error(error.message);
  return fromRow(data as ProcessRow);
}

export async function updateCloudProcess(id: string, process: Process): Promise<void> {
  const { error } = await supabase.from(TABLE).update(toRow(process)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCloudProcess(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
