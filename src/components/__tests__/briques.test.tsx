/**
 * Test de composant : les briques communes de la refonte (bouton, carte,
 * interrupteur, bouton « ? »). On les lit et on les touche comme un utilisateur.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '@/components/card';
import { HelpButton } from '@/components/help-button';
import { PrimaryButton } from '@/components/primary-button';
import { Toggle } from '@/components/toggle';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('briques communes', () => {
  it('le bouton lance son action, sauf s’il est désactivé', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Simuler" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Simuler' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('le bouton désactivé ne fait rien', async () => {
    const blocked = jest.fn();
    await render(<PrimaryButton label="Envoyer" variant="secondary" onPress={blocked} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(blocked).not.toHaveBeenCalled();
  });

  it('la carte simple n’est pas un bouton', async () => {
    await render(
      <Card>
        <Text>Contenu simple</Text>
      </Card>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('la carte qu’on peut toucher est un bouton', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Gestion d’un incident">
        <Text>Gestion d’un incident</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Gestion d’un incident' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('l’interrupteur dit son état et propose l’état inverse', async () => {
    const onValueChange = jest.fn();
    await render(<Toggle value={false} onValueChange={onValueChange} accessibilityLabel="Rappels" />);
    const toggle = screen.getByRole('switch', { name: 'Rappels' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('le bouton « ? » ouvre l’explication, « Compris » la ferme', async () => {
    await render(<HelpButton title="Anonymiser" text="Les noms sont remplacés par des noms neutres." />);
    expect(screen.queryByText('Les noms sont remplacés par des noms neutres.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Expliquer : Anonymiser' }));
    expect(screen.getByRole('header', { name: 'Anonymiser' })).toBeOnTheScreen();
    expect(screen.getByText('Les noms sont remplacés par des noms neutres.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Compris' }));
    expect(screen.queryByText('Les noms sont remplacés par des noms neutres.')).toBeNull();
  });
});
