/**
 * Tous mes projets, vus d'un seul endroit : ceux dont je suis le chef
 * (project-store.ts) et ceux dont je suis collaborateur
 * (team-projects-store.ts), avec mon rôle dans chacun.
 */

import { useMemo } from 'react';

import type { TeamRole } from '@/backend/project-team';
import type { SharedProcess } from '@/backend/shared';
import type { Process, Project } from '@/domain';

import { useProjects } from './project-store';
import { useTeamProjects } from './team-projects-store';

export type ProjectView = { project: Project; role: TeamRole; chefName?: string };

/** Mes projets : ceux que je dirige, puis ceux où je suis collaborateur. */
export function useAllProjects(): ProjectView[] {
  const own = useProjects();
  const team = useTeamProjects();
  return useMemo(() => {
    // Juste après avoir passé le rôle de chef, le projet peut être dans les deux
    // listes le temps d'une synchronisation : c'est la liste d'équipe qui a raison.
    const teamIds = new Set(team.map((item) => item.project.id));
    return [
      ...own.filter((project) => !teamIds.has(project.id)).map((project): ProjectView => ({ project, role: 'chef' })),
      ...team.map((item): ProjectView => ({ project: item.project, role: 'collaborateur', chefName: item.chefName })),
    ];
  }, [own, team]);
}

/** Les process d'un projet : les miens, puis ceux de l'équipe (partagés avec moi). */
export function projectProcesses(
  projectId: string,
  imported: Process[],
  shared: SharedProcess[],
): { process: Process; sharedBy?: string }[] {
  return [
    ...imported.filter((process) => process.projectId === projectId).map((process) => ({ process })),
    ...shared
      .filter((item) => item.process.projectId === projectId)
      .map((item) => ({ process: item.process, sharedBy: item.ownerName })),
  ];
}
