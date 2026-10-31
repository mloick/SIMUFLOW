import { describe, expect, it } from '@jest/globals';

import { copie } from '@/domain/exemples';

import { demoProcesses } from '../demo-processes';
import { isExample, splitExamples } from '../examples';

describe('exemples', () => {
  it('reconnaît les process d’exemple fournis avec l’app', () => {
    expect(demoProcesses.every(isExample)).toBe(true);
    expect(isExample({ ...copie(), id: 'import-1' })).toBe(false);
  });

  it('sépare les process de l’utilisateur des exemples, sans changer l’ordre', () => {
    const mine = [
      { ...copie(), id: 'import-2' },
      { ...copie(), id: 'import-1' },
    ];
    const { own, examples } = splitExamples([mine[0], demoProcesses[1], mine[1], demoProcesses[0]]);
    expect(own.map((process) => process.id)).toEqual(['import-2', 'import-1']);
    expect(examples).toEqual([demoProcesses[1], demoProcesses[0]]);
  });
});
