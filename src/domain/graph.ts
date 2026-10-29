/**
 * Index d'un process pour le parcourir vite : les liens sortants et entrants de
 * chaque étape, les étapes de départ et de fin. Le diagnostic et le calcul des
 * chemins partent tous les deux de cet index.
 */

import type { Link, Process, Step } from './types';

export type ProcessGraph = {
  steps: Map<string, Step>;
  /** Liens sortants de chaque étape, dans l'ordre du process. */
  outgoing: Map<string, Link[]>;
  incoming: Map<string, Link[]>;
  /** Liens dont une extrémité ne correspond à aucune étape. */
  danglingLinks: Link[];
  starts: Step[];
  ends: Step[];
};

export function buildGraph(process: Process): ProcessGraph {
  const steps = new Map<string, Step>();
  const outgoing = new Map<string, Link[]>();
  const incoming = new Map<string, Link[]>();
  const danglingLinks: Link[] = [];

  for (const step of process.steps) {
    steps.set(step.id, step);
    outgoing.set(step.id, []);
    incoming.set(step.id, []);
  }

  for (const link of process.links) {
    const from = outgoing.get(link.from);
    const to = incoming.get(link.to);
    if (!from || !to) {
      danglingLinks.push(link);
      continue;
    }
    from.push(link);
    to.push(link);
  }

  // Sans étape marquée « départ », on prend celles où rien n'arrive mais d'où
  // quelque chose part, comme le prototype web.
  let starts = process.steps.filter((step) => step.kind === 'start');
  if (starts.length === 0) {
    starts = process.steps.filter(
      (step) => incoming.get(step.id)!.length === 0 && outgoing.get(step.id)!.length > 0,
    );
  }
  const ends = process.steps.filter((step) => step.kind === 'end');

  return { steps, outgoing, incoming, danglingLinks, starts, ends };
}

/** Une étape termine un parcours si c'est une fin ou si rien n'en sort. */
export function isTerminal(graph: ProcessGraph, stepId: string): boolean {
  return graph.steps.get(stepId)?.kind === 'end' || graph.outgoing.get(stepId)!.length === 0;
}

/** Étapes que l'on peut atteindre depuis les départs (parcours en largeur). */
export function reachableFromStarts(graph: ProcessGraph): Set<string> {
  const seen = new Set(graph.starts.map((step) => step.id));
  const queue = [...seen];
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

/** Étapes d'où l'on peut atteindre une fin (parcours en largeur à rebours). */
export function canReachEnd(graph: ProcessGraph): Set<string> {
  const seen = new Set(graph.ends.map((step) => step.id));
  const queue = [...seen];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const link of graph.incoming.get(id)!) {
      if (!seen.has(link.from)) {
        seen.add(link.from);
        queue.push(link.from);
      }
    }
  }
  return seen;
}
