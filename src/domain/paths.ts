/**
 * Chemins d'un process, du départ jusqu'à une fin :
 * - cas simple : le chemin le plus court (le moins d'étapes) ;
 * - cas complexe : le chemin le plus long sans repasser par une étape ;
 * - nombre de chemins possibles.
 * Le délai d'un chemin est la somme des délais de ses étapes, en jours ouvrés.
 */

import { buildGraph, isTerminal, type ProcessGraph } from './graph';
import type { Process } from './types';

export type PathStep = {
  stepId: string;
  /** Lien emprunté pour arriver à l'étape (absent pour la première). */
  linkId?: string;
};

export type Path = {
  steps: PathStep[];
  /** Délai cumulé, en jours ouvrés. */
  duration: number;
};

/** Au-delà, le calcul s'arrête : un gros schéma plein de boucles exploserait. */
const MAX_VISITS = 300_000;
export const MAX_COUNTED_PATHS = 2000;

function toPath(graph: ProcessGraph, steps: PathStep[]): Path {
  const duration = steps.reduce((sum, { stepId }) => sum + (graph.steps.get(stepId)?.duration ?? 0), 0);
  return { steps, duration };
}

function firstStart(graph: ProcessGraph, startId?: string): string | undefined {
  return startId ?? graph.starts[0]?.id;
}

/** Cas simple : parcours en largeur, qui trouve la fin la plus proche. */
export function shortestPath(process: Process, startId?: string): Path | null {
  const graph = buildGraph(process);
  const start = firstStart(graph, startId);
  if (!start || !graph.steps.has(start)) return null;

  const previous = new Map<string, { from: string; linkId: string }>();
  const seen = new Set([start]);
  const queue = [start];
  let end: string | undefined;

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (isTerminal(graph, id)) {
      end = id;
      break;
    }
    for (const link of graph.outgoing.get(id)!) {
      if (!seen.has(link.to)) {
        seen.add(link.to);
        previous.set(link.to, { from: id, linkId: link.id });
        queue.push(link.to);
      }
    }
  }
  if (!end) return null;

  const steps: PathStep[] = [];
  for (let id = end; id !== start; ) {
    const { from, linkId } = previous.get(id)!;
    steps.unshift({ stepId: id, linkId });
    id = from;
  }
  steps.unshift({ stepId: start });
  return toPath(graph, steps);
}

/**
 * Cas complexe : parcours en profondeur de tous les chemins sans boucle, et on
 * garde le plus long. Si tout repasse par une étape déjà vue (boucle sans
 * sortie), le chemin s'arrête là.
 */
export function longestPath(process: Process, startId?: string): Path | null {
  const graph = buildGraph(process);
  const start = firstStart(graph, startId);
  if (!start || !graph.steps.has(start)) return null;

  let best: PathStep[] | null = null;
  let visits = 0;
  const onPath = new Set<string>();
  const current: PathStep[] = [{ stepId: start }];

  const keepIfLonger = () => {
    if (!best || current.length > best.length) best = [...current];
  };

  const explore = (id: string) => {
    if (visits++ > MAX_VISITS) return;
    if (isTerminal(graph, id)) {
      keepIfLonger();
      return;
    }
    onPath.add(id);
    let moved = false;
    for (const link of graph.outgoing.get(id)!) {
      if (onPath.has(link.to)) continue;
      moved = true;
      current.push({ stepId: link.to, linkId: link.id });
      explore(link.to);
      current.pop();
    }
    if (!moved) keepIfLonger();
    onPath.delete(id);
  };

  explore(start);
  return best ? toPath(graph, best) : null;
}

/** Nombre de chemins sans boucle d'un départ à une fin, plafonné. */
export function countPaths(process: Process): { count: number; capped: boolean } {
  const graph = buildGraph(process);
  let count = 0;
  let visits = 0;
  const onPath = new Set<string>();

  const explore = (id: string) => {
    if (count >= MAX_COUNTED_PATHS || visits++ > MAX_VISITS) return;
    if (isTerminal(graph, id)) {
      count++;
      return;
    }
    onPath.add(id);
    for (const link of graph.outgoing.get(id)!) {
      if (!onPath.has(link.to)) explore(link.to);
    }
    onPath.delete(id);
  };

  for (const start of graph.starts) explore(start.id);
  return { count, capped: count >= MAX_COUNTED_PATHS || visits > MAX_VISITS };
}
