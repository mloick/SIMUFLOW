/**
 * L'équipe d'un projet (voir supabase/migrations/20261121000000_equipe_projet.sql).
 * Comme pour le partage d'un process, l'app ne lit jamais la liste des
 * comptes : elle passe par `invite_to_project`, `team_of` et `team_projects`,
 * qui ne répondent qu'à l'équipe du projet.
 */

import type { Project } from '@/domain';

import { supabase } from './client';
import { SharingError, sharingErrorMessage } from './sharing';
import { getT } from '@/i18n';

export type TeamRole = 'chef' | 'collaborateur';

export type TeamMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: TeamRole;
};

/** Un projet dont je suis collaborateur, avec le nom de son chef. */
export type TeamProject = { project: Project; chefName: string };

type TeamRow = {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: TeamRole;
};

type TeamProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  chef_first_name: string | null;
  chef_last_name: string | null;
  chef_username: string | null;
};

/** « Julie Martin », sinon « @julie.martin », sinon « Membre sans profil ». */
export function personName(person: { firstName: string | null; lastName: string | null; username: string | null }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || (person.username ? `@${person.username}` : getT().errors.otherAccount);
}

const fromRow = (row: TeamRow): TeamMember => ({
  id: row.member_id,
  firstName: row.first_name,
  lastName: row.last_name,
  username: row.username,
  role: row.role === 'chef' ? 'chef' : 'collaborateur',
});

export function toTeamProject(row: TeamProjectRow): TeamProject {
  return {
    project: {
      id: row.id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      createdAt: row.created_at,
    },
    chefName: personName({ firstName: row.chef_first_name, lastName: row.chef_last_name, username: row.chef_username }),
  };
}

/** Message d'erreur : « seul le chef » à la place de « seul le propriétaire du process ». */
export function teamErrorMessage(error: { code?: string; message?: string }): SharingError {
  if (error.code === '42501') return new SharingError(getT().projects.team.chefOnly);
  if (error.code === 'P0002' && /équipe/.test(error.message ?? ''))
    return new SharingError(getT().projects.team.notInTeam);
  if (error.code === '22023') return new SharingError(getT().projects.team.itsYou);
  if (error.code === '54000') return new SharingError(getT().projects.team.tooMany);
  return sharingErrorMessage(error);
}

/** L'équipe du projet : le chef d'abord, puis les collaborateurs. */
export async function listTeam(projectId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('team_of', { p_project: projectId });
  if (error) throw teamErrorMessage(error);
  return ((data ?? []) as TeamRow[]).map(fromRow);
}

/** Invite un compte dans l'équipe, par son identifiant ou son adresse e-mail. */
export async function inviteToProject(projectId: string, who: string): Promise<TeamMember> {
  const { data, error } = await supabase.rpc('invite_to_project', { p_project: projectId, p_who: who });
  if (error) throw teamErrorMessage(error);
  const row = ((data ?? []) as TeamRow[])[0];
  if (!row) throw teamErrorMessage({});
  return fromRow(row);
}

/** Retire un collaborateur (le chef seulement). Ses process sortent du projet. */
export async function removeFromTeam(projectId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('member_id', memberId);
  if (error) throw teamErrorMessage(error);
}

/** Quitter un projet dont je suis collaborateur. Mes process en sortent. */
export async function leaveProject(projectId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw teamErrorMessage({});
  await removeFromTeam(projectId, userId);
}

/** Nomme un collaborateur chef de projet ; l'ancien chef reste, comme collaborateur. */
export async function transferChef(projectId: string, memberId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_chef', { p_project: projectId, p_member: memberId });
  if (error) throw teamErrorMessage(error);
}

/** Les projets dont je suis collaborateur. */
export async function listTeamProjects(): Promise<TeamProject[]> {
  const { data, error } = await supabase.rpc('team_projects');
  if (error) throw teamErrorMessage(error);
  return ((data ?? []) as TeamProjectRow[]).map(toTeamProject);
}
