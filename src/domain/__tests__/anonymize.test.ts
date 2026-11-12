import { describe, expect, it } from '@jest/globals';

import { anonymizeProcess, parseHiddenWords, serviceName } from '../anonymize';
import type { Process } from '../types';

const process: Process = {
  id: 'p',
  name: 'Demande Société Fictive pour l’Équipe Achats',
  steps: [
    { id: 'a', kind: 'start', title: 'Demande reçue', actor: 'Équipe Achats', layout: { x: 1, y: 2, width: 3, height: 4 } },
    { id: 'b', kind: 'decision', title: 'L’equipe achats valide ?', actor: 'Équipe Achats' },
    { id: 'c', kind: 'task', title: 'Écrire à jean.exemple@exemple.test ou au 01 23 45 67 89', actor: 'Comptabilité', duration: 2 },
    { id: 'd', kind: 'task', title: 'Voir https://exemple.test/aide, délai 12 jours', actor: 'Comptabilité Nord' },
    { id: 'e', kind: 'end', title: 'Fin' },
  ],
  links: [
    { id: 'l1', from: 'a', to: 'b' },
    { id: 'l2', from: 'b', to: 'c', label: 'Oui, envoyé à Comptabilité' },
    { id: 'l3', from: 'b', to: 'd', label: 'Non' },
    { id: 'l4', from: 'c', to: 'e' },
    { id: 'l5', from: 'd', to: 'e' },
  ],
};

describe('anonymizeProcess', () => {
  const { process: anonymous, actorCount, text } = anonymizeProcess(process, { hidden: ['Société Fictive'] });

  it('renomme chaque acteur en service, dans l’ordre d’apparition', () => {
    expect(actorCount).toBe(3);
    expect(anonymous.steps.map((step) => step.actor)).toEqual([
      'Service A',
      'Service A',
      'Service B',
      'Service C',
      undefined,
    ]);
  });

  it('remplace les noms d’acteurs dans les textes, sans tenir compte des accents ni des majuscules', () => {
    expect(anonymous.steps[1].title).toBe('Le Service A valide ?');
    expect(anonymous.links[1].label).toBe('Oui, envoyé à Service B');
    expect(anonymous.name).toBe('Demande [masqué] pour le Service A');
  });

  it('masque les e-mails, téléphones et liens, mais garde les petits nombres', () => {
    expect(anonymous.steps[2].title).toBe('Écrire à adresse masquée ou au numéro masqué');
    expect(anonymous.steps[3].title).toBe('Voir lien masqué, délai 12 jours');
  });

  it('garde la forme du process', () => {
    expect(anonymous.steps.map((step) => [step.id, step.kind, step.duration, step.layout])).toEqual(
      process.steps.map((step) => [step.id, step.kind, step.duration, step.layout]),
    );
    expect(anonymous.links.map((link) => [link.from, link.to])).toEqual(process.links.map((link) => [link.from, link.to]));
    expect(process.steps[0].actor).toBe('Équipe Achats');
  });

  it('applique les mêmes remplacements à un autre texte', () => {
    expect(text('Copie pour Comptabilité Nord')).toBe('Copie pour Service C');
    expect(text('Comptabilités')).toBe('Comptabilités');
  });
});

describe('outils', () => {
  it('nomme les services au-delà de Z', () => {
    expect([serviceName(0), serviceName(25), serviceName(26)]).toEqual(['Service A', 'Service Z', 'Service 27']);
  });

  it('lit les mots à masquer', () => {
    expect(parseHiddenWords(' Société X, Client Y ;\nZ ')).toEqual(['Société X', 'Client Y', 'Z']);
  });
});
