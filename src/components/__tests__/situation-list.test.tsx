/**
 * Test de composant : les situations d'un workflow avec SLA et OLA, leur
 * pastille, le choix de celle à importer et ses avertissements.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { situationMeta, SituationList } from '@/components/situation-list';
import { readTableFile, workbookToSituations } from '@/import/tableau';

import { lireExemple } from '../../../jest/lire-exemple';

const { situations } = workbookToSituations(readTableFile('workflow-sla-ola.xlsx', lireExemple('workflow-sla-ola.xlsx')));

describe('SituationList', () => {
  it('résume chaque situation et montre les avertissements de celle choisie', async () => {
    const onSelect = jest.fn();
    await render(<SituationList situations={situations} selected={3} onSelect={onSelect} skipped={2} />);
    expect(screen.getByText('6 situations : chacune devient un process · 4 à vérifier. 2 lignes sans SLA ni étape, pas encore décrites, sont ignorées.')).toBeOnTheScreen();
    expect(screen.getByText('Famille Y')).toBeOnTheScreen();
    expect(screen.getAllByText('Lue sans ambiguïté')).toHaveLength(2);
    expect(screen.getByText('SLA de 4 JO différent de OLA 1 + OLA 2 (6 JO).')).toBeOnTheScreen();
    expect(screen.queryByText(/Reprise en main mentionnée/)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: /^Cas 2,/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('écrit le SLA et les groupes avec leur OLA', () => {
    expect(situationMeta(situations[0])).toBe('SLA 6 JO · Groupe A (3 JO) → Groupe B (3 JO)');
    expect(situationMeta({ ...situations[0], slaDays: null, steps: [] })).toBe('SLA ? · aucune étape');
  });
});
