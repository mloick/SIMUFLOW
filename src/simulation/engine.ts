/**
 * Moteur de simulation : on avance d'étape en étape, en choisissant la sortie
 * à chaque décision. Chaque fonction prend un état et renvoie le nouvel état,
 * sans rien modifier : l'écran garde l'état, le moteur calcule.
 */

import { buildGraph, type Link, type PathStep, type Process, type ProcessGraph, type Step } from '@/domain';

export type SimulationStatus =
  /** Le parcours continue : il reste une ou plusieurs sorties. */
  | 'running'
  /** Une fin est atteinte. */
  | 'finished'
  /** Une étape sans sortie qui n'est pas une fin : une impasse. */
  | 'stuck'
  /** Le process n'a pas de départ : rien à simuler. */
  | 'no-start';

export type SimulationState = {
  /** Étapes parcourues, dans l'ordre, avec le lien emprunté pour y arriver. */
  trail: PathStep[];
  status: SimulationStatus;
  /** Délai cumulé, en jours ouvrés. */
  days: number;
};

export type Simulation = {
  graph: ProcessGraph;
  start: (startId?: string) => SimulationState;
  /** Étape où l'on se trouve. */
  current: (state: SimulationState) => Step | undefined;
  /** Sorties possibles depuis l'étape courante. */
  choices: (state: SimulationState) => Link[];
  /** Avance par la sortie choisie. */
  step: (state: SimulationState, linkId: string) => SimulationState;
  /** Revient à l'étape précédente. */
  back: (state: SimulationState) => SimulationState;
  /** Rejoue un chemin déjà calculé (cas simple, cas complexe). */
  replay: (steps: PathStep[]) => SimulationState;
};

export function createSimulation(process: Process): Simulation {
  const graph = buildGraph(process);

  const outgoing = (stepId: string | undefined) => (stepId ? (graph.outgoing.get(stepId) ?? []) : []);

  const stateOf = (trail: PathStep[]): SimulationState => {
    if (trail.length === 0) return { trail, status: 'no-start', days: 0 };
    const days = trail.reduce((sum, { stepId }) => sum + (graph.steps.get(stepId)?.duration ?? 0), 0);
    const last = graph.steps.get(trail[trail.length - 1].stepId);
    let status: SimulationStatus = 'running';
    if (last?.kind === 'end') status = 'finished';
    else if (outgoing(last?.id).length === 0) status = 'stuck';
    return { trail, status, days };
  };

  const current = (state: SimulationState) => {
    const last = state.trail[state.trail.length - 1];
    return last ? graph.steps.get(last.stepId) : undefined;
  };

  return {
    graph,
    start: (startId) => {
      const first = startId ?? graph.starts[0]?.id;
      return stateOf(first && graph.steps.has(first) ? [{ stepId: first }] : []);
    },
    current,
    choices: (state) => (state.status === 'running' ? outgoing(current(state)?.id) : []),
    step: (state, linkId) => {
      const link = outgoing(current(state)?.id).find((candidate) => candidate.id === linkId);
      if (state.status !== 'running' || !link) return state;
      return stateOf([...state.trail, { stepId: link.to, linkId: link.id }]);
    },
    back: (state) => (state.trail.length > 1 ? stateOf(state.trail.slice(0, -1)) : state),
    replay: (steps) => stateOf(steps),
  };
}
