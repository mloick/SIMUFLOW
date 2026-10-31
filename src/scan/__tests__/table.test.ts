import { describe, expect, it } from '@jest/globals';

import type { TextLine } from '../../../modules/text-recognition';
import tableaux from '../__fixtures__/tableaux.json';
import { groupRows } from '../rows';
import { findTable, headerKind } from '../table';

/**
 * Les six tableaux de docs/exemples/tableaux-a-scanner.html, tels qu'une photo
 * de la page les donne : chaque photo prend aussi le texte autour (fin du
 * tableau précédent, titres, explications, « Attendu »). Positions relevées
 * dans la page affichée par un navigateur.
 */
const photo = (id: string) => {
  const found = tableaux.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return findTable(groupRows(found.lines as TextLine[]));
};

describe('tableau trouvé dans la photo', () => {
  it('reconnaît les titres de colonnes, avec ou sans accents', () => {
    expect(headerKind('Étape')).toBe('step');
    expect(headerKind('TÂCHE')).toBe('step');
    expect(headerKind('Responsable')).toBe('actor');
    expect(headerKind('Durée')).toBe('delay');
    expect(headerKind('N°')).toBe('number');
    expect(headerKind('Suite')).toBe('next');
    expect(headerKind('Demande de matériel')).toBeNull();
  });

  it('1. garde le tableau seul et ignore le texte autour', () => {
    const table = photo('t1');
    expect(table?.columns.map((column) => column.kind)).toEqual(['step', 'actor', 'delay']);
    expect(table?.rows).toEqual([
      ['Recevoir la demande', 'Accueil', '0,5 JO'],
      ['Valider le besoin', 'Manager', '1 JO'],
      ['Commander', 'Achats', '3 JO'],
      ['Livrer et clôturer', 'Logistique', '2 JO'],
    ]);
    expect(table?.ignored).toBeGreaterThan(0);
  });

  it('2. lit d’autres titres dans un autre ordre', () => {
    const table = photo('t2');
    expect(table?.columns.map((column) => column.kind)).toEqual(['actor', 'step', 'delay']);
    expect(table?.rows).toHaveLength(4);
    expect(table?.rows[0]).toEqual(['Ressources humaines', 'Préparer le contrat', '2 jours']);
  });

  it('3. garde les numéros, les cases vides et la colonne Suite', () => {
    const table = photo('t3');
    expect(table?.columns.map((column) => column.kind)).toEqual(['number', 'step', 'actor', 'delay', 'next']);
    expect(table?.rows).toHaveLength(5);
    expect(table?.rows[1]).toEqual(['2', 'Montant supérieur à 500 € ?', 'Comptabilité', '', 'oui → 3 ; non → 4']);
    expect(table?.rows[4]).toEqual(['5', 'Archiver', 'Comptabilité', '', 'fin']);
  });

  it('4. garde les délais tels qu’ils sont écrits', () => {
    expect(photo('t4')?.rows.map((row) => row[2])).toEqual(['4 h', '3 jours', '1 sem.', '2', '—']);
  });

  it('5. recolle un titre écrit sur deux lignes et laisse vide un acteur manquant', () => {
    const table = photo('t5');
    expect(table?.rows).toHaveLength(4);
    expect(table?.rows[1]).toEqual(['2', 'Relire', '', '1 JO', '3']);
    expect(table?.rows[3]).toEqual(['4', "Mettre en page et publier sur l'intranet", 'Communication', '1 JO', 'fin']);
  });

  it('6. lit les sept lignes du tableau complet', () => {
    const table = photo('t6');
    expect(table?.rows.map((row) => row[0])).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(table?.rows[3]).toEqual(['4', 'Période chargée ?', 'Manager', '', 'oui → 6 ; non → 5']);
  });

  it('ne trouve rien sans ligne d’en-tête', () => {
    const line = (text: string, y: number): TextLine => ({ text, confidence: 1, x: 0.1, y, width: 0.3, height: 0.03 });
    expect(findTable(groupRows([line('Liste de courses', 0.1), line('Pain', 0.2)]))).toBeNull();
  });
});
