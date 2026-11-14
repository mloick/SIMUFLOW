import { describe, expect, it } from '@jest/globals';

import { copie, demandeMateriel } from '@/domain/exemples';
import { overviewOf } from '@/simulation/families';

import { briefOf } from '../brief';

const brief = (process = demandeMateriel, colorNames?: string[]) =>
  briefOf(process, overviewOf(process), { colorNames });

describe('résumé « En bref »', () => {
  it('raconte le départ, les acteurs et chaque cas avec sa couleur', () => {
    const { intro, cases, outro } = brief(demandeMateriel, ['bleu', 'vert']);
    expect(intro[0]).toBe(
      'Ce process part de « Demande reçue » et fait intervenir 4 acteurs : Employé, Responsable, Achats et Logistique.',
    );
    expect(intro[1]).toBe('Il se sépare en 2 cas à la question « Demande validée ? » :');
    expect(cases).toEqual([
      'En bleu, « oui » : 3 étapes, 8 JO, jusqu’à « Demande close ». C’est le cas le plus long.',
      'En vert, « non » : 2 étapes, 3 JO, jusqu’à « Demande close ». C’est le cas le plus rapide.',
    ]);
    expect(outro).toBe('Aucune anomalie : le process peut être diffusé tel quel.');
  });

  it('sans couleurs, ne nomme pas de couleur', () => {
    expect(brief().cases[0]).toMatch(/^« oui »/);
  });

  it('résume un chemin unique en une phrase', () => {
    const process = copie();
    process.links = process.links.filter((link) => link.id !== 'l3');
    process.steps = process.steps.filter((step) => step.id !== 'refus');
    process.links = process.links.filter((link) => link.id !== 'l6');
    const { intro, cases } = brief(process);
    expect(cases).toEqual([]);
    expect(intro[1]).toBe('Un seul chemin : 3 étapes, 8 JO, jusqu’à « Demande close ».');
  });

  it('signale une impasse et les anomalies', () => {
    const process = copie();
    process.links = process.links.filter((link) => link.id !== 'l6');
    const { cases, outro } = brief(process);
    expect(cases[1]).toContain('bloqué à « Prévenir du refus » (impasse)');
    expect(outro).toMatch(/^À revoir avant de diffuser : \d+ anomalies?/);
  });
});
