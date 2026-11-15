/**
 * Côté membre d'un process partagé (voir supabase/migrations/20261118000000_avis.sql) :
 * les process partagés avec le compte, et ses avis étape par étape.
 */

import type { Process, ReviewStatus, StepReview } from '@/domain';

import { supabase } from './client';
import { fromRow as processFromRow, type ProcessRow } from './process-row';
import { sharingErrorMessage } from './sharing';
import { getT } from '@/i18n';

/** Un process partagé avec le compte connecté. */
export type SharedProcess = {
  /** Le process, avec un identifiant propre au téléphone (`partage-<id serveur>`). */
  process: Process;
  cloudId: string;
  /** Acteur du schéma confié au membre, s'il y en a un. */
  actor: string | null;
  /** Qui l'a partagé : « Julie Martin », ou son identifiant. */
  ownerName: string;
  /**
   * Membre du process (il peut donner son avis). `false` : lu seulement parce
   * qu'il est rangé dans un projet de mon équipe. Absent (anciennes données) : membre.
   */
  member?: boolean;
  updatedAt: string;
};

type SharedRow = {
  process_id: string;
  name: string;
  source: ProcessRow['source'];
  content: ProcessRow['content'];
  updated_at: string;
  actor: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_username: string | null;
  /** Ajoutés par 20261121000000_equipe_projet.sql. */
  project_id?: string | null;
  is_member?: boolean;
};

type ReviewRow = { step_id: string; status: ReviewStatus; comment: string | null };

const SHARED_PREFIX = 'partage-';

/** Identifiant sur le téléphone d'un process partagé. */
export const sharedLocalId = (cloudId: string) => `${SHARED_PREFIX}${cloudId}`;

export function toShared(row: SharedRow): SharedProcess {
  const process = processFromRow({
    id: row.process_id,
    owner_id: '',
    name: row.name,
    source: row.source,
    content: row.content,
    project_id: row.project_id ?? null,
    created_at: row.updated_at,
    updated_at: row.updated_at,
  });
  const name = [row.owner_first_name, row.owner_last_name].filter(Boolean).join(' ').trim();
  return {
    process: { ...process, id: sharedLocalId(row.process_id) },
    cloudId: row.process_id,
    actor: row.actor?.trim() || null,
    ownerName: name || (row.owner_username ? `@${row.owner_username}` : getT().errors.otherAccount),
    member: row.is_member !== false,
    updatedAt: row.updated_at,
  };
}

/** Les process partagés avec le compte connecté, les plus récents d'abord. */
export async function listSharedWithMe(): Promise<SharedProcess[]> {
  const { data, error } = await supabase.rpc('shared_with_me');
  if (error) throw sharingErrorMessage(error);
  const shared: SharedProcess[] = [];
  for (const row of (data ?? []) as SharedRow[]) {
    try {
      shared.push(toShared(row));
    } catch {
      // Un process mal enregistré ne cache pas les autres.
    }
  }
  return shared;
}

/** Mes avis sur un process partagé. */
export async function listMyReviews(cloudId: string): Promise<StepReview[]> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw sharingErrorMessage({});
  const { data, error } = await supabase
    .from('step_reviews')
    .select('step_id, status, comment')
    .eq('process_id', cloudId)
    .eq('member_id', userId);
  if (error) throw sharingErrorMessage(error);
  return ((data ?? []) as ReviewRow[]).map((row) => ({
    stepId: row.step_id,
    status: row.status,
    comment: row.comment,
  }));
}

/** Donne ou change mon avis sur une étape. */
export async function saveReview(cloudId: string, review: StepReview): Promise<void> {
  const comment = review.comment?.trim() || null;
  const { error } = await supabase
    .from('step_reviews')
    .upsert(
      { process_id: cloudId, step_id: review.stepId, status: review.status, comment },
      { onConflict: 'process_id,member_id,step_id' },
    );
  if (error) throw sharingErrorMessage(error);
}

/** Retire mon avis sur une étape (elle redevient « à relire »). */
export async function removeReview(cloudId: string, stepId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw sharingErrorMessage({});
  const { error } = await supabase
    .from('step_reviews')
    .delete()
    .eq('process_id', cloudId)
    .eq('member_id', userId)
    .eq('step_id', stepId);
  if (error) throw sharingErrorMessage(error);
}
