/**
 * Moteur de simulation : on avance d'étape en étape, en choisissant la sortie
 * à chaque décision. Chaque fonction prend un état et renvoie le nouvel état,
 * sans rien modifier : l'écran garde l'état, le moteur calcule.
 *
 * Tâches en parallèle : une étape « En parallèle » (`kind: 'parallel'`) à
 * plusieurs sorties lance toutes ses branches en même temps ; à plusieurs
 * entrées, c'est une jonction, qui attend que chaque entrée soit arrivée avant
 * de laisser passer. Le moteur suit alors plusieurs branches à la fois, chacune
 * avec son propre délai ; à la jonction, on garde le délai de la plus longue.
 *
 * Un process sans étape « En parallèle » n'a jamais qu'une branche : il avance
 * exactement comme avant (mêmes étapes, même délai, même statut).
 *
 * L'état se recalcule toujours depuis le départ et la liste des choix faits
 * (`moves`) : revenir en arrière, c'est rejouer les choix sauf le dernier.
 */

import { buildGraph, type Link, type PathStep, type Process, type ProcessGraph, type Step } from '@/domain';

export type SimulationStatus =
  /** Le parcours continue : il reste une ou plusieurs sorties. */
  | 'running'
  /** Une fin est atteinte (par toutes les branches, s'il y en a plusieurs). */
  | 'finished'
  /** Une étape sans sortie qui n'est pas une fin (une impasse), ou une jonction qui attend une branche bloquée. */
  | 'stuck'
  /** Le process n'a pas de départ : rien à simuler. */
  | 'no-start';

/** Une branche du parcours : là où elle se trouve et le délai cumulé pour y arriver. */
export type Branch = {
  stepId: string;
  /** Délai cumulé sur cette branche, en jours ouvrés. */
  days: number;
  /** Lien emprunté pour arriver à l'étape (absent pour le départ). */
  linkId?: string;
};

export type SimulationState = {
  /** Étapes parcourues, dans l'ordre, avec le lien emprunté pour y arriver. */
  trail: PathStep[];
  status: SimulationStatus;
  /** Délai cumulé, en jours ouvrés (celui de la branche la plus longue). */
  days: number;
  /** Liens choisis par l'utilisateur, dans l'ordre : de quoi rejouer l'état. */
  moves: string[];
  /** Branches en cours ou arrivées au bout (une seule sans étape « En parallèle »). */
  branches: Branch[];
  /** Branches arrivées à une jonction, qui attendent les autres. */
  waiting: Branch[];
};

export type Simulation = {
  graph: ProcessGraph;
  start: (startId?: string) => SimulationState;
  /** Étape où l'on se trouve (la première branche qui peut encore avancer). */
  current: (state: SimulationState) => Step | undefined;
  /** Sorties possibles depuis les étapes en cours (toutes branches confondues). */
  choices: (state: SimulationState) => Link[];
  /** Avance par la sortie choisie, sur la branche d'où part ce lien. */
  step: (state: SimulationState, linkId: string) => SimulationState;
  /** Annule le dernier choix. */
  back: (state: SimulationState) => SimulationState;
  /** Rejoue un chemin déjà calculé (cas simple, cas complexe). */
  replay: (steps: PathStep[]) => SimulationState;
  /** Branches qui peuvent encore avancer, chacune avec ses sorties. */
  activeBranches: (state: SimulationState) => { branch: Branch; step: Step; choices: Link[] }[];
  /** Liens d'une jonction par lesquels aucune branche n'est encore arrivée (« En attente de… »). */
  waitingFor: (state: SimulationState, joinId: string) => Link[];
};

export function createSimulation(process: Process): Simulation {
  const graph = buildGraph(process);
  const links = new Map(process.links.map((link) => [link.id, link]));

  const outgoing = (stepId: string | undefined) => (stepId ? (graph.outgoing.get(stepId) ?? []) : []);
  const incoming = (stepId: string) => graph.incoming.get(stepId) ?? [];

  /** Une branche peut avancer si elle n'est pas sur une fin et que son étape a une sortie. */
  const canMove = (branch: Branch) =>
    graph.steps.get(branch.stepId)?.kind !== 'end' && outgoing(branch.stepId).length > 0;

  /** Recalcule l'état depuis le départ, en appliquant les choix un par un. */
  const run = (first: string | undefined, moves: string[]): SimulationState => {
    if (!first || !graph.steps.has(first)) {
      return { trail: [], status: 'no-start', days: 0, moves: [], branches: [], waiting: [] };
    }
    const trail: PathStep[] = [];
    // Jonctions : les branches déjà arrivées, qui attendent les autres.
    const arrivals = new Map<string, Branch[]>();

    /** Entre dans une étape et renvoie les branches qui en repartent (souvent une seule, aucune si elle attend). */
    const enter = (stepId: string, days: number, linkId?: string): Branch[] => {
      trail.push(linkId ? { stepId, linkId } : { stepId });
      const step = graph.steps.get(stepId)!;
      const duration = step.duration ?? 0;
      if (step.kind !== 'parallel') return [{ stepId, days: days + duration, ...(linkId ? { linkId } : {}) }];

      // Jonction : on attend une branche par lien entrant.
      const expected = incoming(stepId).length;
      if (expected >= 2) {
        const arrived = [...(arrivals.get(stepId) ?? []), { stepId, days, ...(linkId ? { linkId } : {}) }];
        if (arrived.length < expected) {
          arrivals.set(stepId, arrived);
          return [];
        }
        arrivals.delete(stepId);
        days = Math.max(...arrived.map((branch) => branch.days));
      }
      days += duration;

      // Partage : chaque sortie lance sa branche, sans choix à faire.
      const exits = outgoing(stepId);
      if (exits.length < 2) return [{ stepId, days, ...(linkId ? { linkId } : {}) }];
      return exits.flatMap((exit) => enter(exit.to, days, exit.id));
    };

    let branches = enter(first, 0);
    const applied: string[] = [];
    for (const linkId of moves) {
      const link = links.get(linkId);
      const index = link ? branches.findIndex((branch) => branch.stepId === link.from && canMove(branch)) : -1;
      // Un lien déjà pris tout seul (sortie d'un partage) ou qui ne part d'aucune branche est ignoré.
      if (!link || index === -1 || !graph.steps.has(link.to)) continue;
      const moved = branches[index];
      branches = [...branches.slice(0, index), ...enter(link.to, moved.days, link.id), ...branches.slice(index + 1)];
      applied.push(linkId);
    }

    const waiting = [...arrivals.values()].flat();
    const days = Math.max(0, ...branches.map((branch) => branch.days), ...waiting.map((branch) => branch.days));
    let status: SimulationStatus = 'running';
    if (!branches.some(canMove)) {
      const allEnded =
        waiting.length === 0 && branches.every((branch) => graph.steps.get(branch.stepId)?.kind === 'end');
      status = allEnded ? 'finished' : 'stuck';
    }
    return { trail, status, days, moves: applied, branches, waiting };
  };

  const firstOf = (state: SimulationState) => state.trail[0]?.stepId;

  const activeBranches = (state: SimulationState) =>
    state.status !== 'running'
      ? []
      : state.branches.filter(canMove).map((branch) => ({
          branch,
          step: graph.steps.get(branch.stepId)!,
          choices: outgoing(branch.stepId),
        }));

  const current = (state: SimulationState) => {
    const active = state.branches.find(canMove);
    const stepId = active?.stepId ?? state.trail[state.trail.length - 1]?.stepId;
    return stepId ? graph.steps.get(stepId) : undefined;
  };

  const choices = (state: SimulationState) => {
    // Deux branches sur la même étape proposent les mêmes sorties : on ne les montre qu'une fois.
    const unique = new Map<string, Link>();
    for (const active of activeBranches(state)) for (const link of active.choices) unique.set(link.id, link);
    return [...unique.values()];
  };

  return {
    graph,
    start: (startId) => run(startId ?? graph.starts[0]?.id, []),
    current,
    choices,
    step: (state, linkId) => {
      if (!choices(state).some((link) => link.id === linkId)) return state;
      return run(firstOf(state), [...state.moves, linkId]);
    },
    back: (state) => (state.moves.length > 0 ? run(firstOf(state), state.moves.slice(0, -1)) : state),
    replay: (steps) =>
      run(
        steps[0]?.stepId,
        steps.slice(1).flatMap((item) => (item.linkId ? [item.linkId] : [])),
      ),
    activeBranches,
    waitingFor: (state, joinId) => {
      const arrived = new Set(state.waiting.filter((branch) => branch.stepId === joinId).map((branch) => branch.linkId));
      return incoming(joinId).filter((link) => !arrived.has(link.id));
    },
  };
}
