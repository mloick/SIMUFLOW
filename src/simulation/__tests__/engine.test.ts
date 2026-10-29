import { describe, expect, it } from '@jest/globals';

import { longestPath, shortestPath } from '@/domain';
import { copie, demandeMateriel } from '@/domain/exemples';

import { createSimulation } from '../engine';

const sim = () => createSimulation(demandeMateriel);

describe('simulation pas à pas', () => {
  it('commence au départ', () => {
    const s = sim();
    const state = s.start();
    expect(state.status).toBe('running');
    expect(s.current(state)?.kind).toBe('start');
    expect(state.trail[0].linkId).toBeUndefined();
  });

  it('avance par la sortie choisie et cumule les délais', () => {
    const s = sim();
    let state = s.start();
    while (state.status === 'running') state = s.step(state, s.choices(state)[0].id);
    expect(['finished', 'stuck']).toContain(state.status);
    const total = state.trail.reduce((sum, { stepId }) => sum + (s.graph.steps.get(stepId)?.duration ?? 0), 0);
    expect(state.days).toBe(total);
    expect(s.choices(state)).toEqual([]);
  });

  it('ignore une sortie qui ne part pas de l’étape courante', () => {
    const s = sim();
    const state = s.start();
    expect(s.step(state, 'inconnu')).toBe(state);
  });

  it('revient en arrière, sans dépasser le départ', () => {
    const s = sim();
    const start = s.start();
    const next = s.step(start, s.choices(start)[0].id);
    expect(s.back(next).trail).toEqual(start.trail);
    expect(s.back(start)).toBe(start);
  });

  it('rejoue le cas simple et le cas complexe jusqu’à une fin', () => {
    const s = sim();
    const simple = s.replay(shortestPath(demandeMateriel)!.steps);
    const complexe = s.replay(longestPath(demandeMateriel)!.steps);
    expect(simple.status).toBe('finished');
    expect(complexe.trail.length).toBeGreaterThanOrEqual(simple.trail.length);
  });

  it('signale une impasse et un process sans départ', () => {
    const impasse = copie();
    const start = impasse.steps.find((step) => step.kind === 'start')!;
    impasse.links = impasse.links.filter((link) => link.from !== start.id);
    impasse.steps.push({ id: 'seule', kind: 'task', title: 'Seule' });
    impasse.links.push({ id: 'vers-seule', from: start.id, to: 'seule' });
    const s = createSimulation(impasse);
    expect(s.step(s.start(), 'vers-seule').status).toBe('stuck');

    expect(createSimulation({ id: 'vide', name: 'Vide', steps: [], links: [] }).start().status).toBe('no-start');
  });
});
