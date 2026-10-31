import { describe, expect, it } from '@jest/globals';

import type { TextLine } from '../../../modules/text-recognition';
import { groupRows, tableSize } from '../rows';

/** Un morceau de texte à la colonne `x` et à la ligne `y` (hauteur 0,04, comme un texte de photo). */
const at = (text: string, x: number, y: number, tilt = 0): TextLine => ({
  text,
  confidence: 0.9,
  x,
  y: y + tilt * x,
  width: 0.2,
  height: 0.04,
});

describe('lignes du tableau photographié', () => {
  it('range les morceaux par ligne puis de gauche à droite, même dans le désordre', () => {
    const lines = [
      at('Accueil', 0.4, 0.2),
      at('Étape', 0.1, 0.1),
      at('0,5 JO', 0.7, 0.2),
      at('Acteur', 0.4, 0.1),
      at('Recevoir la demande', 0.1, 0.2),
      at('Délai', 0.7, 0.1),
    ];
    expect(groupRows(lines).map((row) => row.cells)).toEqual([
      ['Étape', 'Acteur', 'Délai'],
      ['Recevoir la demande', 'Accueil', '0,5 JO'],
    ]);
  });

  it('garde ensemble une ligne photographiée un peu de biais', () => {
    const lines = [at('Commander', 0.1, 0.3, 0.03), at('Achats', 0.4, 0.3, 0.03), at('3 JO', 0.7, 0.3, 0.03)];
    expect(groupRows(lines).map((row) => row.cells)).toEqual([['Commander', 'Achats', '3 JO']]);
  });

  it('ignore les morceaux vides et compte lignes et colonnes', () => {
    const rows = groupRows([at('Étape', 0.1, 0.1), at('  ', 0.4, 0.1), at('Payer', 0.1, 0.2), at('1 JO', 0.7, 0.2)]);
    expect(rows.map((row) => row.cells)).toEqual([['Étape'], ['Payer', '1 JO']]);
    expect(tableSize(rows)).toEqual({ rows: 2, columns: 2 });
    expect(tableSize([])).toEqual({ rows: 0, columns: 0 });
  });
});
