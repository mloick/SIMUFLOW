import { describe, expect, it } from '@jest/globals';

import { delayLevel, delayRatio, hasDelays, setSla, slaOf } from '../delays';
import type { Process } from '../types';

const process: Process = {
  id: 'p',
  name: 'Demande',
  steps: [
    { id: '1', kind: 'start', title: 'Demander' },
    { id: '2', kind: 'end', title: 'Clore' },
  ],
  links: [{ id: 'a', from: '1', to: '2' }],
};

describe('mode Délais : règles', () => {
  it('passe du vert à l’orange aux trois quarts, puis au rouge après le délai', () => {
    expect(delayLevel(0, 4)).toBe('ok');
    expect(delayLevel(2.9, 4)).toBe('ok');
    expect(delayLevel(3, 4)).toBe('warning');
    expect(delayLevel(4, 4)).toBe('warning');
    expect(delayLevel(4.1, 4)).toBe('late');
  });

  it('borne la part consommée entre 0 et 1', () => {
    expect(delayRatio(1, 4)).toBe(0.25);
    expect(delayRatio(8, 4)).toBe(1);
    expect(delayRatio(-1, 4)).toBe(0);
    expect(delayRatio(1, 0)).toBe(1);
  });

  it('ajoute, change et retire le SLA', () => {
    expect(slaOf(process)).toBeUndefined();
    expect(hasDelays(process)).toBe(false);
    const withSla = setSla(process, 6);
    expect(slaOf(withSla)).toBe(6);
    expect(hasDelays(withSla)).toBe(true);
    expect('sla' in setSla(withSla, null)).toBe(false);
    expect('sla' in setSla(withSla, 0)).toBe(false);
    expect(process.sla).toBeUndefined(); // le process d'origine ne change pas
  });

  it('voit un OLA sans SLA', () => {
    expect(
      hasDelays({
        ...process,
        steps: [{ ...process.steps[0], duration: 2 }, process.steps[1]],
      }),
    ).toBe(true);
  });
});
