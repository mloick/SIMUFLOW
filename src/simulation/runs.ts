/**
 * Chemins d'un process avec des tâches en parallèle : cas simple, cas
 * complexe, nombre de chemins et liste des chemins pour « Tous les cas ».
 *
 * Avec des branches en parallèle, un « chemin » n'est plus une ligne : c'est
 * un parcours complet où toutes les branches avancent. On le calcule avec le
 * moteur de simulation lui-même (engine.ts), en essayant chaque sortie de
 * chaque décision ; les branches sans choix avancent toutes seules. Le délai
 * d'un parcours est celui du moteur : la branche la plus longue compte.
 *
 * Un process sans étape « En parallèle » garde exactement les fonctions de
 * src/domain/paths.ts (shortestPath, longestPath, countPaths) et allPaths :
 * ces fonctions-ci ne font que choisir.
 */

import {
  countPaths,
  hasParallel,
  isJoin,
  longestPath,
  MAX_COUNTED_PATHS,
  shortestPath,
  type Path,
  type Process,
} from '@/domain';

import { createSimulation, type SimulationState } from './engine';

/** Au-delà, le calcul s'arrête : un gros schéma plein de boucles exploserait. */
const MAX_VISITS = 100_000;

/**
 * Tous les parcours complets d'un process avec des tâches en parallèle, plafonnés à `max`.
 * Chaque parcours est donné comme un chemin : les étapes dans l'ordre où le moteur les a
 * parcourues, et le délai de la branche la plus longue.
 */
export function parallelRuns(process: Process, max: number): { paths: Path[]; capped: boolean } {
  const sim = createSimulation(process);
  const paths: Path[] = [];
  let visits = 0;
  let capped = false;

  const keep = (state: SimulationState) => {
    if (paths.length >= max) capped = true;
    else paths.push({ steps: state.trail, duration: state.days });
  };

  // Comme pour les chemins sans parallèle, on ne repasse pas par une étape déjà vue (pas de boucle),
  // sauf une jonction ou une fin, où plusieurs branches arrivent normalement.
  const loopsBack = (state: SimulationState, stepId: string) =>
    !isJoin(sim.graph, stepId) &&
    sim.graph.steps.get(stepId)?.kind !== 'end' &&
    state.trail.some((item) => item.stepId === stepId);

  const explore = (state: SimulationState) => {
    if (capped || visits++ > MAX_VISITS) {
      capped = true;
      return;
    }
    if (state.status !== 'running') return keep(state);
    const active = sim.activeBranches(state);
    // Une branche sans choix à faire avance d'abord : l'ordre ne change ni les étapes ni le délai.
    const branch = active.find((item) => item.choices.length === 1) ?? active[0];
    if (!branch) return keep(state);
    const options = branch.choices.filter((link) => !loopsBack(state, link.to));
    // Toutes les sorties reviennent en arrière : le parcours s'arrête ici.
    if (options.length === 0) return keep(state);
    for (const link of options) explore(sim.step(state, link.id));
  };

  for (const start of sim.graph.starts) explore(sim.start(start.id));
  return { paths, capped };
}

/** Cas simple : le parcours le plus court en étapes (sans parallèle : `shortestPath`). */
export function simpleCase(process: Process): Path | null {
  if (!hasParallel(process)) return shortestPath(process);
  const { paths } = parallelRuns(process, MAX_COUNTED_PATHS);
  return paths.reduce<Path | null>(
    (best, path) => (!best || path.steps.length < best.steps.length ? path : best),
    null,
  );
}

/** Cas complexe : le parcours le plus long en étapes (sans parallèle : `longestPath`). */
export function complexCase(process: Process): Path | null {
  if (!hasParallel(process)) return longestPath(process);
  const { paths } = parallelRuns(process, MAX_COUNTED_PATHS);
  return paths.reduce<Path | null>(
    (best, path) => (!best || path.steps.length > best.steps.length ? path : best),
    null,
  );
}

/** Nombre de chemins, plafonné (sans parallèle : `countPaths`). */
export function pathCount(process: Process): { count: number; capped: boolean } {
  if (!hasParallel(process)) return countPaths(process);
  const { paths, capped } = parallelRuns(process, MAX_COUNTED_PATHS);
  return { count: paths.length, capped };
}
