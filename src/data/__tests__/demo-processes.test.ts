import { describe, expect, it } from '@jest/globals';

import { summarize } from '@/domain';

import { demoProcesses } from '../demo-processes';

const byId = (id: string) => summarize(demoProcesses.find((p) => p.id === id)!);

describe('process de démonstration', () => {
  it('ont des identifiants uniques', () => {
    expect(new Set(demoProcesses.map((p) => p.id)).size).toBe(demoProcesses.length);
  });

  it('montrent chaque état du diagnostic', () => {
    expect(byId('demande-acces')).toMatchObject({ errorCount: 0, warningCount: 0 });
    expect(byId('changement-standard')).toMatchObject({ errorCount: 0, warningCount: 0 });
    expect(byId('commande-materiel')).toMatchObject({ errorCount: 1, warningCount: 0 });
    expect(byId('gestion-incident')).toMatchObject({ errorCount: 0, warningCount: 2 });
    expect(byId('gestion-incident').issues.map((i) => i.code)).toEqual(['unlabeled-branch', 'dead-end']);
  });
});
