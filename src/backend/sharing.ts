/**
 * Partage d'un process avec des membres (voir
 * supabase/migrations/20261117000000_partage.sql). L'app ne lit jamais la
 * liste des comptes : elle passe par les fonctions `invite_member` et
 * `members_of`, qui ne répondent qu'au propriétaire et aux membres du process.
 */

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
