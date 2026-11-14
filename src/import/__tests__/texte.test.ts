import { describe, expect, it } from '@jest/globals';

import { ImportError, importProcessFile, looksLikeProcessText, parseProcessText } from '..';

const EXEMPLE = `Process : Demande de matériel
1. Employé : Faire la demande
2. Responsable : Demande validée ? (2 JO)
   oui → 3
   non → 5
3. Achats : Passer la commande (1 JO)
4. Logistique : Livrer le matériel (5 JO) → 6
5. Responsable : Prévenir du refus (1 JO) → 6
6. Fin : Demande close`;

const read = (text: string) => parseProcessText(text, 'Sans titre', 't');

describe('import de texte', () => {
  it('lit étapes, acteurs, délais, cas et fin', () => {
    const { processes, warnings } = read(EXEMPLE);
    const [process] = processes;
    expect(process.name).toBe('Demande de matériel');
    expect(process.source).toBe('texte');
    expect(process.steps.map((s) => [s.kind, s.title, s.actor, s.duration])).toEqual([
      ['start', 'Faire la demande', 'Employé', undefined],
      ['decision', 'Demande validée ?', 'Responsable', 2],
      ['task', 'Passer la commande', 'Achats', 1],
      ['task', 'Livrer le matériel', 'Logistique', 5],
      ['task', 'Prévenir du refus', 'Responsable', 1],
      ['end', 'Demande close', undefined, undefined],
    ]);
    expect(process.links.map((l) => `${l.from}>${l.to}${l.label ? `:${l.label}` : ''}`)).toEqual([
      't-s1>t-s2',
      't-s2>t-s3:oui',
      't-s2>t-s5:non',
      't-s3>t-s4',
      't-s4>t-s6',
      't-s5>t-s6',
    ]);
    expect(warnings).toEqual([]);
  });

  it('enchaîne une simple liste sans numéros ni acteurs', () => {
    const [process] = read('- Recevoir le colis\n- Vérifier puis signer le bon\n- Ranger, 2 h').processes;
    expect(process.steps.map((s) => s.title)).toEqual(['Recevoir le colis', 'Vérifier puis signer le bon', 'Ranger']);
    expect(process.steps.map((s) => s.kind)).toEqual(['start', 'task', 'end']);
    expect(process.steps[2].duration).toBe(0.25);
    expect(process.links).toHaveLength(2);
  });

  it('comprend « puis 4 », « si non : fin » et « Début : »', () => {
    const [process] = read(
      'Début : Ticket ouvert\nService A : Urgent ?\n si oui : 3\n si non : 4\nService B : Traiter vite puis 5\nService A : Traiter\nFin : Ticket clos',
    ).processes;
    expect(process.steps[0]).toMatchObject({
      kind: 'start',
      title: 'Ticket ouvert',
    });
    expect(process.steps[0].actor).toBeUndefined();
    expect(process.steps[1].kind).toBe('decision');
    expect(process.links.filter((l) => l.from === 't-s3').map((l) => l.to)).toEqual(['t-s5']);
    expect(process.steps[4].kind).toBe('end');
  });

  it('signale une suite inconnue et refuse un texte vide ou des numéros en double', () => {
    expect(read('1. A\n2. B → 9').warnings).toContain('Étape 2 : la suite 9 n’existe pas dans le texte.');
    expect(() => read('   \n\n')).toThrow(ImportError);
    expect(() => read('1. A\n1. B')).toThrow(/même numéro/);
  });

  it('passe par l’import de fichier pour un .txt', () => {
    const [process] = importProcessFile('demande-materiel.txt', '1. Faire\n2. Finir', 'f').processes;
    expect(process.name).toBe('demande materiel');
    expect(looksLikeProcessText(EXEMPLE)).toBe(true);
    expect(looksLikeProcessText('{"a":1}')).toBe(false);
  });
});
