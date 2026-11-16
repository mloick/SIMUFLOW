import { describe, expect, it } from '@jest/globals';

import { buildGraph, diagnose, hasParallel, isJoin, isSplit, type Link, type PathStep, type Process } from '@/domain';
import { demandeMateriel } from '@/domain/exemples';
import { demoProcesses } from '@/data/demo-processes';

import { createSimulation } from '../engine';

/** Commande validée → facture (compta) et colis (logistique) en même temps → Expédier. */
const commande: Process = {
  id: 'commande',
  name: 'Commande',
  steps: [
    { id: 'debut', kind: 'start', title: 'Commande validée' },
    { id: 'partage', kind: 'parallel', title: 'En parallèle' },
    { id: 'facture', kind: 'task', title: 'Préparer la facture', actor: 'Compta', duration: 1 },
    { id: 'colis', kind: 'task', title: 'Préparer le colis', actor: 'Logistique', duration: 3 },
    { id: 'jonction', kind: 'parallel', title: 'Tout est prêt' },
    { id: 'expedier', kind: 'task', title: 'Expédier', actor: 'Logistique', duration: 1 },
    { id: 'fin', kind: 'end', title: 'Commande expédiée' },
  ],
  links: [
    { id: 'l1', from: 'debut', to: 'partage' },
    { id: 'l2', from: 'partage', to: 'facture' },
    { id: 'l3', from: 'partage', to: 'colis' },
    { id: 'l4', from: 'facture', to: 'jonction' },
    { id: 'l5', from: 'colis', to: 'jonction' },
    { id: 'l6', from: 'jonction', to: 'expedier' },
    { id: 'l7', from: 'expedier', to: 'fin' },
  ],
};

/**
 * Le moteur d'avant les tâches en parallèle, recopié tel quel : un process
 * sans étape « En parallèle » doit donner exactement les mêmes résultats.
 */
function oldEngine(process: Process) {
  const graph = buildGraph(process);
  const outgoing = (id?: string) => (id ? (graph.outgoing.get(id) ?? []) : []);
  const stateOf = (trail: PathStep[]) => {
    if (trail.length === 0) return { trail, status: 'no-start', days: 0 };
    const days = trail.reduce((sum, { stepId }) => sum + (graph.steps.get(stepId)?.duration ?? 0), 0);
    const last = graph.steps.get(trail[trail.length - 1].stepId);
    let status = 'running';
    if (last?.kind === 'end') status = 'finished';
    else if (outgoing(last?.id).length === 0) status = 'stuck';
    return { trail, status, days };
  };
  const current = (trail: PathStep[]) => trail[trail.length - 1]?.stepId;
  return {
    start: () => stateOf(graph.starts[0] ? [{ stepId: graph.starts[0].id }] : []),
    choices: (s: { trail: PathStep[]; status: string }): Link[] => (s.status === 'running' ? outgoing(current(s.trail)) : []),
    step: (s: { trail: PathStep[] }, link: Link) => stateOf([...s.trail, { stepId: link.to, linkId: link.id }]),
    back: (s: { trail: PathStep[] }) => (s.trail.length > 1 ? stateOf(s.trail.slice(0, -1)) : s),
  };
}

describe('process sans tâches en parallèle : rien ne change', () => {
  const processes = [demandeMateriel, ...demoProcesses];

  it('aucun des exemples n’a d’étape « En parallèle »', () => {
    for (const process of processes) expect(hasParallel(process)).toBe(false);
  });

  it('avance, revient et finit exactement comme l’ancien moteur, par tous les choix possibles', () => {
    for (const process of processes) {
      const now = createSimulation(process);
      const before = oldEngine(process);
      // Plusieurs parcours : à la n-ième décision, on prend la sortie n modulo le nombre de sorties.
      for (let seed = 0; seed < 6; seed++) {
        let state = now.start();
        let reference = before.start();
        for (let turn = 0; turn < 40 && state.status === 'running'; turn++) {
          const choices = now.choices(state);
          expect(choices).toEqual(before.choices(reference));
          expect(now.current(state)?.id).toBe(reference.trail.at(-1)?.stepId);
          const link = choices[(seed + turn) % choices.length];
          state = now.step(state, link.id);
          reference = before.step(reference, link);
          expect(state.trail).toEqual(reference.trail);
          expect(state.days).toBe(reference.days);
          expect(state.status).toBe(reference.status);
          expect(state.branches).toHaveLength(1);
          expect(state.waiting).toEqual([]);
        }
        const back = now.back(state);
        expect(back.trail).toEqual(before.back(reference).trail);
      }
    }
  });
});

describe('tâches en parallèle', () => {
  it('lance toutes les branches en même temps après le partage', () => {
    const s = createSimulation(commande);
    const state = s.step(s.start(), 'l1');
    expect(state.status).toBe('running');
    expect(state.branches.map((branch) => branch.stepId)).toEqual(['facture', 'colis']);
    expect(s.choices(state).map((link) => link.id)).toEqual(['l4', 'l5']);
    expect(s.activeBranches(state).map((active) => active.step.actor)).toEqual(['Compta', 'Logistique']);
  });

  it('la jonction attend toutes les branches, dans n’importe quel ordre', () => {
    const s = createSimulation(commande);
    for (const order of [
      ['l5', 'l4'],
      ['l4', 'l5'],
    ]) {
      let state = s.step(s.start(), 'l1');
      state = s.step(state, order[0]);
      // Une branche est arrivée : la jonction l'attend, l'autre branche peut encore avancer.
      expect(state.waiting).toHaveLength(1);
      expect(s.waitingFor(state, 'jonction').map((link) => link.id)).toEqual([order[1]]);
      expect(s.choices(state).map((link) => link.id)).toEqual([order[1]]);
      expect(s.choices(state).some((link) => link.id === 'l6')).toBe(false);

      state = s.step(state, order[1]);
      expect(state.waiting).toEqual([]);
      expect(state.branches.map((branch) => branch.stepId)).toEqual(['jonction']);
      expect(s.choices(state).map((link) => link.id)).toEqual(['l6']);
    }
  });

  it('le délai est celui de la branche la plus longue', () => {
    const s = createSimulation(commande);
    let state = s.step(s.start(), 'l1');
    state = s.step(state, 'l4');
    expect(state.days).toBe(3); // le colis (3 j) est déjà en cours, la facture (1 j) est finie
    state = s.step(state, 'l5');
    state = s.step(state, 'l6');
    state = s.step(state, 'l7');
    expect(state.status).toBe('finished');
    expect(state.days).toBe(4); // max(1, 3) + 1 pour Expédier, pas 1 + 3 + 1
  });

  it('revient en arrière choix par choix', () => {
    const s = createSimulation(commande);
    const split = s.step(s.start(), 'l1');
    const one = s.step(split, 'l5');
    const back = s.back(one);
    expect(back.branches).toEqual(split.branches);
    expect(back.waiting).toEqual([]);
    expect(s.back(back).trail).toEqual(s.start().trail);
  });

  it('ne finit que quand toutes les branches sont au bout', () => {
    // Deux branches qui finissent chacune sur leur propre fin, sans jonction.
    const deuxFins: Process = {
      id: 'deux-fins',
      name: 'Deux fins',
      steps: [
        { id: 'd', kind: 'start', title: 'Départ' },
        { id: 'p', kind: 'parallel', title: 'En parallèle' },
        { id: 'a', kind: 'task', title: 'A' },
        { id: 'b', kind: 'task', title: 'B' },
        { id: 'fa', kind: 'end', title: 'Fin A' },
        { id: 'fb', kind: 'end', title: 'Fin B' },
      ],
      links: [
        { id: '1', from: 'd', to: 'p' },
        { id: '2', from: 'p', to: 'a' },
        { id: '3', from: 'p', to: 'b' },
        { id: '4', from: 'a', to: 'fa' },
        { id: '5', from: 'b', to: 'fb' },
      ],
    };
    const s = createSimulation(deuxFins);
    let state = s.step(s.step(s.start(), '1'), '4');
    expect(state.status).toBe('running');
    state = s.step(state, '5');
    expect(state.status).toBe('finished');
  });

  it('se bloque si une branche tombe dans une impasse avant la jonction', () => {
    // Le colis passe un contrôle ; s'il est perdu, la branche n'arrive jamais à la jonction.
    const impasse: Process = {
      ...commande,
      id: 'impasse',
      steps: [
        ...commande.steps,
        { id: 'controle', kind: 'decision', title: 'Colis complet ?' },
        { id: 'perdu', kind: 'task', title: 'Colis perdu' },
      ],
      links: [
        ...commande.links.map((link) => (link.id === 'l5' ? { ...link, from: 'controle', label: 'oui' } : link)),
        { id: 'l8', from: 'colis', to: 'controle' },
        { id: 'l9', from: 'controle', to: 'perdu', label: 'non' },
      ],
    };
    const s = createSimulation(impasse);
    let state = s.step(s.start(), 'l1');
    state = s.step(state, 'l4');
    state = s.step(state, 'l8');
    state = s.step(state, 'l9');
    expect(state.status).toBe('stuck');
    expect(s.choices(state)).toEqual([]);
    expect(s.waitingFor(state, 'jonction').map((link) => link.id)).toEqual(['l5']);
  });

  it('rejoue un chemin en ignorant les sorties du partage, prises toutes seules', () => {
    const s = createSimulation(commande);
    const state = s.replay([
      { stepId: 'debut' },
      { stepId: 'partage', linkId: 'l1' },
      { stepId: 'facture', linkId: 'l2' },
      { stepId: 'jonction', linkId: 'l4' },
    ]);
    expect(state.moves).toEqual(['l1', 'l4']);
    expect(state.waiting).toHaveLength(1);
  });
});

describe('repères et diagnostic des tâches en parallèle', () => {
  it('reconnaît le partage et la jonction', () => {
    const graph = buildGraph(commande);
    expect(isSplit(graph, 'partage')).toBe(true);
    expect(isJoin(graph, 'partage')).toBe(false);
    expect(isJoin(graph, 'jonction')).toBe(true);
    expect(hasParallel(commande)).toBe(true);
  });

  it('ne demande pas de libellés sur les sorties d’un partage', () => {
    expect(diagnose(commande)).toEqual([]);
  });

  it('signale une jonction que rien ne lance en parallèle', () => {
    // Une décision suivie d'une jonction : une seule branche y arrivera jamais.
    const decision: Process = {
      ...commande,
      steps: commande.steps.map((step) => (step.id === 'partage' ? { ...step, kind: 'decision', title: 'Stock ?' } : step)),
      links: commande.links.map((link) =>
        link.id === 'l2' ? { ...link, label: 'oui' } : link.id === 'l3' ? { ...link, label: 'non' } : link,
      ),
    };
    const issues = diagnose(decision);
    expect(issues).toEqual([{ severity: 'warning', code: 'join-without-split', stepId: 'jonction', params: { count: 2 } }]);
  });

  it('signale une étape « En parallèle » sans branches', () => {
    const seule: Process = {
      ...commande,
      steps: commande.steps.map((step) => (step.id === 'expedier' ? { ...step, kind: 'parallel' } : step)),
    };
    expect(diagnose(seule).map((issue) => issue.code)).toEqual(['parallel-no-branch']);
  });
});
