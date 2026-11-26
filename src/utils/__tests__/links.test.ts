import { describe, expect, it } from '@jest/globals';

import { splitLinks } from '@/utils/links';

describe('splitLinks', () => {
  it('laisse un texte sans lien tel quel', () => {
    expect(splitLinks('Aucun lien ici.')).toEqual([{ text: 'Aucun lien ici.' }]);
    expect(splitLinks('')).toEqual([]);
  });

  it('sépare les liens du texte, sans la ponctuation qui les suit', () => {
    expect(splitLinks('Voir https://exemple.fr/a?b=1. Ou (www.exemple.fr), merci')).toEqual([
      { text: 'Voir ' },
      { text: 'https://exemple.fr/a?b=1', url: 'https://exemple.fr/a?b=1' },
      { text: '. Ou (' },
      { text: 'www.exemple.fr', url: 'https://www.exemple.fr' },
      { text: '), merci' },
    ]);
  });
});
