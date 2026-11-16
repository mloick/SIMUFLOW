/**
 * Données du tableau de bord d'un projet : pour chaque process du projet, ses
 * membres et leurs avis, lus sur le serveur. Un process pas encore envoyé sur
 * le serveur compte comme « pas partagé ».
 */

import { useCallback, useEffect, useState } from 'react';

import type { DashboardInput, Process } from '@/domain';
import { getT } from '@/i18n';

import { loadValidation } from './validation-data';

/** Un process du projet et son identifiant sur le serveur, s'il y est. */
export type DashboardSource = { process: Process; cloudId?: string };

export type DashboardData =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; inputs: DashboardInput[] };

/** Lit tous les process d'un coup ; une seule erreur suffit à afficher « Réessayer ». */
export async function loadDashboard(sources: DashboardSource[]): Promise<DashboardInput[]> {
  return Promise.all(
    sources.map(async ({ process, cloudId }) =>
      cloudId ? { process, ...(await loadValidation(cloudId)) } : { process, members: [], reviews: [] },
    ),
  );
}

/** `reload` relit tout (après une erreur, ou pour voir les nouveaux avis). */
export function useDashboardData(sources: DashboardSource[]): DashboardData & { reload: () => void } {
  const [data, setData] = useState<DashboardData>({ status: 'loading' });
  // Relire seulement quand la liste des process change, pas à chaque affichage.
  const key = sources.map((source) => `${source.process.id}:${source.cloudId ?? ''}`).join('|');

  const fetchData = useCallback(
    () =>
      loadDashboard(sources).then(
        (inputs) => setData({ status: 'ready', inputs }),
        (cause: unknown) =>
          setData({
            status: 'error',
            message: cause instanceof Error ? cause.message : getT().errors.trackingRead,
          }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reload = useCallback(() => {
    setData({ status: 'loading' });
    fetchData();
  }, [fetchData]);

  return { ...data, reload };
}
