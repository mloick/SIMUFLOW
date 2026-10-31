/**
 * Test de composant : le message des états « vide » et « erreur » de la liste.
 * On l'affiche comme sur le téléphone, puis on le lit et on le touche comme un
 * utilisateur (par son texte et son rôle, pas par son code).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { StateMessage } from '@/components/state-message';

describe('StateMessage', () => {
  it('affiche le titre comme un titre, le message et le bouton', async () => {
    await render(
      <StateMessage
        icon={{ ios: 'tray', android: 'inbox' }}
        tone="primary"
        title="Aucun process"
        message="Importez un schéma draw.io pour commencer."
        action={{ label: 'Importer un process', onPress: () => {} }}
      />,
    );

    expect(screen.getByRole('header', { name: 'Aucun process' })).toBeOnTheScreen();
    expect(screen.getByText('Importez un schéma draw.io pour commencer.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Importer un process' })).toBeOnTheScreen();
  });

  it('lance l’action quand on touche le bouton', async () => {
    const onPress = jest.fn();
    await render(
      <StateMessage
        icon={{ ios: 'exclamationmark.triangle', android: 'error' }}
        tone="danger"
        title="Chargement impossible"
        message="Vérifiez votre connexion."
        action={{ label: 'Réessayer', onPress }}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
