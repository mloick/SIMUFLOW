import { describe, expect, it } from '@jest/globals';

import { personName, teamErrorMessage, toTeamProject } from '../project-team';

describe('équipe d’un projet', () => {
  it('lit un projet d’équipe avec le nom de son chef', () => {
    const item = toTeamProject({
      id: 'p1',
      name: 'Migration du support',
      description: null,
      created_at: '2026-11-15T10:00:00Z',
      chef_first_name: 'Camille',
      chef_last_name: 'Durand',
      chef_username: 'camille',
    });
    expect(item).toEqual({
      project: { id: 'p1', name: 'Migration du support', createdAt: '2026-11-15T10:00:00Z' },
      chefName: 'Camille Durand',
    });
  });

  it('nomme une personne par son nom, sinon son identifiant', () => {
    expect(personName({ firstName: 'Julie', lastName: 'Martin', username: 'julie.martin' })).toBe('Julie Martin');
    expect(personName({ firstName: null, lastName: null, username: 'julie.martin' })).toBe('@julie.martin');
    expect(personName({ firstName: null, lastName: null, username: null })).toBe('un autre compte');
  });

  it('donne un message clair pour chaque refus du serveur', () => {
    expect(teamErrorMessage({ code: '42501' }).message).toBe('Seul le chef de projet peut faire cela.');
    expect(
      teamErrorMessage({ code: 'P0002', message: 'Cette personne n’est pas dans l’équipe du projet.' }).message,
    ).toBe('Cette personne n’est pas dans l’équipe du projet.');
    expect(teamErrorMessage({ code: 'P0002', message: 'Aucun compte' }).message).toBe(
      'Aucun compte SimuFlow avec cet identifiant ou cette adresse.',
    );
    expect(teamErrorMessage({ code: '22023' }).message).toBe('C’est vous : vous êtes déjà le chef de ce projet.');
    expect(teamErrorMessage({ code: 'PGRST202' }).message).toMatch(/script SQL/);
  });
});
