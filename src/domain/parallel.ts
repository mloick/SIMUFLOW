/**
 * Tâches en parallèle : une étape « En parallèle » (`kind: 'parallel'`) joue le
 * rôle de la porte parallèle du BPMN.
 * - Partage : plusieurs sorties, toutes les branches démarrent en même temps.
 * - Jonction : plusieurs entrées, on attend que toutes les branches soient arrivées.
 * Une même étape peut faire les deux. Sans étape de ce type, le process est
 * séquentiel et se lit exactement comme avant.
 */

import type { ProcessGraph } from './graph';
import type { Process } from './types';

/** Le process contient-il des tâches en parallèle ? */
export function hasParallel(process: Process): boolean {
  return process.steps.some((step) => step.kind === 'parallel');
}

/** Étape « En parallèle » qui lance plusieurs branches. */
export function isSplit(graph: ProcessGraph, stepId: string): boolean {
  return graph.steps.get(stepId)?.kind === 'parallel' && (graph.outgoing.get(stepId)?.length ?? 0) >= 2;
}

/** Étape « En parallèle » qui attend plusieurs branches. */
export function isJoin(graph: ProcessGraph, stepId: string): boolean {
  return graph.steps.get(stepId)?.kind === 'parallel' && (graph.incoming.get(stepId)?.length ?? 0) >= 2;
}

/** Étapes que l'on peut atteindre en partant d'un partage (sans compter le partage lui-même, sauf s'il est dans une boucle). */
export function reachableFromSplits(graph: ProcessGraph): Set<string> {
  const queue = [...graph.steps.keys()]
    .filter((id) => isSplit(graph, id))
    .flatMap((id) => graph.outgoing.get(id)!.map((link) => link.to));
  const seen = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const link of graph.outgoing.get(id)!) {
      if (!seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
      }
    }
  }
  return seen;
}
