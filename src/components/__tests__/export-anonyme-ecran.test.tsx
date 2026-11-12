/**
 * Test d'écran : exporter un process anonymisé. Les acteurs deviennent
 * Service A, B…, les mots choisis sont masqués, jusque dans le nom du fichier.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ExportScreen from '@/app/export/[id]';
import { demandeMateriel } from '@/domain/exemples';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'demande-materiel' }),
}));
jest.mock('@/data/process-store', () => ({
  getProcess: () => jest.requireActual<typeof import('@/domain/exemples')>('@/domain/exemples').demandeMateriel,
}));
jest.mock('@/utils/share-file', () => ({ sharePdf: jest.fn(), shareTextFile: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('ExportScreen', () => {
  it('partage un fichier anonymisé', async () => {
    const { shareTextFile } = jest.requireMock<{ shareTextFile: jest.Mock }>('@/utils/share-file');
    await render(<ExportScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /JSON/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Anonymiser les noms/ }));
    await fireEvent.changeText(screen.getByLabelText('Autres mots à masquer'), 'matériel');
    expect(screen.getByText('4 acteurs renommés · partagé sous le nom « Demande de [masqué] »')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Partager'));
    const [fileName, text] = shareTextFile.mock.calls[0] as [string, string];
    expect(fileName).toBe('demande-de-masque.json');
    const shared = JSON.parse(text) as { steps: { actor?: string; title: string }[] };
    expect(shared.steps.map((step) => step.actor)).toEqual([
      'Service A',
      'Service B',
      'Service C',
      'Service D',
      'Service B',
      undefined,
    ]);
    expect(shared.steps[3].title).toBe('Livrer le [masqué]');
    expect(text).not.toMatch(/Responsable|Logistique|matériel/);
    expect(demandeMateriel.steps[1].actor).toBe('Responsable');
  });
});
