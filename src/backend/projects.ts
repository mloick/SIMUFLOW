/**
 * Lecture et écriture des projets du compte connecté sur le serveur (table
 * `public.projects`, voir 20261120000000_projets.sql). Les règles de sécurité
 * (RLS) limitent chaque requête aux projets dont le compte est le chef.
 */

import type { Project } from '@/domain';

import { supabase } from './client';

const TABLE = 'projects';

/** Une ligne de la table, telle que Supabase la renvoie. */
export type ProjectRow = {
  id: string;
  chef_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export function projectToRow(project: Project) {
  return { id: project.id, name: project.name.trim(), description: project.description?.trim() || null };
}

export function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    createdAt: row.created_at,
  };
}

/** Les projets du compte, du plus récent au plus ancien. */
export async function listCloudProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ProjectRow[]).map(projectFromRow);
}

/** Crée le projet sur le serveur, sous l'identifiant choisi par le téléphone. */
export async function createCloudProject(project: Project): Promise<void> {
  const { error } = await supabase.from(TABLE).insert(projectToRow(project));
  if (error) throw new Error(error.message);
}

export async function updateCloudProject(project: Project): Promise<void> {
  const { id, ...changes } = projectToRow(project);
  const { error } = await supabase.from(TABLE).update(changes).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCloudProject(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
