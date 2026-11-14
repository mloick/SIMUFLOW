/**
 * Partage d'un process avec des membres (voir
 * supabase/migrations/20261117000000_partage.sql). L'app ne lit jamais la
 * liste des comptes : elle passe par les fonctions `invite_member` et
 * `members_of`, qui ne répondent qu'au propriétaire et aux membres du process.
 */

import type { MemberReview } from '@/domain';

import { supabase } from './client';

export type Member = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  /** Acteur du schéma dont le membre s'occupe. */
  actor: string | null;
};

type MemberRow = {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  actor: string | null;
};

const fromRow = (row: MemberRow): Member => ({
  id: row.member_id,
  firstName: row.first_name,
  lastName: row.last_name,
  username: row.username,
  actor: row.actor,
});

/** Erreur de partage, avec un message prêt à afficher. */
export class SharingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SharingError';
  }
}

/** Message pour une erreur de la base (codes posés par les fonctions SQL). */
export function sharingErrorMessage(error: { code?: string; message?: string }): SharingError {
  switch (error.code) {
    case 'P0002':
      return new SharingError('Aucun compte SimuFlow avec cet identifiant ou cette adresse.');
    case '42501':
      return new SharingError('Seul le propriétaire du process peut inviter ou retirer des membres.');
    case '22023':
      return new SharingError('C’est vous : vous êtes déjà le propriétaire de ce process.');
    case '54000':
      return new SharingError('Un process compte au plus 100 membres.');
    case '23505':
      return new SharingError('Cet acteur a déjà un lien.');
    case '23503':
      return new SharingError('Vous n’êtes plus membre de ce process : son propriétaire vous en a retiré.');
    case '23514':
      return new SharingError('Avis incomplet : dites ce qui est à revoir (1 000 caractères au plus).');
    case 'PGRST202':
    case '42883':
    case '42P01':
      return new SharingError('Le serveur n’a pas encore le partage : le script SQL est à appliquer.');
    default:
      return new SharingError('Le partage n’a pas pu se faire. Vérifiez la connexion et réessayez.');
  }
}

/** Les membres d'un process (son identifiant sur le serveur). */
export async function listMembers(cloudId: string): Promise<Member[]> {
  const { data, error } = await supabase.rpc('members_of', { p_process: cloudId });
  if (error) throw sharingErrorMessage(error);
  return ((data ?? []) as MemberRow[]).map(fromRow);
}

/** Invite un compte par son identifiant ou son adresse e-mail ; le réinviter change son acteur. */
export async function inviteMember(cloudId: string, who: string, actor: string | null): Promise<Member> {
  const { data, error } = await supabase.rpc('invite_member', { p_process: cloudId, p_who: who, p_actor: actor });
  if (error) throw sharingErrorMessage(error);
  const rows = (data ?? []) as MemberRow[];
  if (!rows[0]) throw new SharingError('Le partage n’a pas pu se faire. Réessayez.');
  return fromRow(rows[0]);
}

/** Retire un membre du process. */
export async function removeMember(cloudId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('process_members').delete().eq('process_id', cloudId).eq('member_id', memberId);
  if (error) throw sharingErrorMessage(error);
}

/** Nom affiché d'un membre : « Julie Martin », sinon son identifiant, sinon « Membre sans profil ». */
export function memberName(member: Member): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || (member.username ? `@${member.username}` : 'Membre sans profil');
}

type ProcessReviewRow = { member_id: string; step_id: string; status: 'valide' | 'a_revoir'; comment: string | null };

/**
 * Tous les avis des membres sur un process, pour son propriétaire (les règles
 * de la table `step_reviews` ne donnent à un membre que les siens).
 */
export async function listProcessReviews(cloudId: string): Promise<MemberReview[]> {
  const { data, error } = await supabase
    .from('step_reviews')
    .select('member_id, step_id, status, comment')
    .eq('process_id', cloudId);
  if (error) throw sharingErrorMessage(error);
  return ((data ?? []) as ProcessReviewRow[]).map((row) => ({
    memberId: row.member_id,
    stepId: row.step_id,
    status: row.status,
    comment: row.comment,
  }));
}

type MembershipRow = { process_id: string; member_id: string; actor: string | null };
type DatedReviewRow = ProcessReviewRow & { process_id: string; updated_at: string };

/**
 * Membres et avis de plusieurs process d'un coup (pour les alertes du
 * propriétaire) : deux requêtes, quel que soit le nombre de process.
 */
export async function listSharingActivity(cloudIds: string[]): Promise<{
  members: MembershipRow[];
  reviews: (MemberReview & { processId: string; updatedAt: string })[];
}> {
  if (cloudIds.length === 0) return { members: [], reviews: [] };
  const [members, reviews] = await Promise.all([
    supabase.from('process_members').select('process_id, member_id, actor').in('process_id', cloudIds),
    supabase
      .from('step_reviews')
      .select('process_id, member_id, step_id, status, comment, updated_at')
      .in('process_id', cloudIds),
  ]);
  if (members.error) throw sharingErrorMessage(members.error);
  if (reviews.error) throw sharingErrorMessage(reviews.error);
  return {
    members: (members.data ?? []) as MembershipRow[],
    reviews: ((reviews.data ?? []) as DatedReviewRow[]).map((row) => ({
      processId: row.process_id,
      memberId: row.member_id,
      stepId: row.step_id,
      status: row.status,
      comment: row.comment,
      updatedAt: row.updated_at,
    })),
  };
}
