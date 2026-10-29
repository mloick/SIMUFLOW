import { describe, expect, it } from '@jest/globals';

import { copie, demandeMateriel } from '../exemples';
import { summarize } from '../summary';

describe('summarize', () => {
  it('compte les étapes, les décisions et les acteurs', () => {
    const summary = summarize(demandeMateriel);
    expect(summary.stepCount).toBe(6);
    expect(summary.decisionCount).toBe(1);
    expect(summary.actors).toEqual(['Employé', 'Responsable', 'Achats', 'Logistique']);
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(0);
  });

  it('compte les anomalies par gravité', () => {
    const p = copie();
    p.links = p.links.filter((l) => l.id !== 'l3' && l.id !== 'l6');
    const summary = summarize(p);
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBeGreaterThan(0);
  });
});
