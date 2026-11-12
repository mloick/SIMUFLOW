/**
 * Test d'écran : remplir le formulaire d'un template, voir les questions
 * conditionnelles apparaître, être arrêté par une réponse manquante, puis
 * obtenir le récapitulatif de la demande.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FormScreen from '@/app/formulaire';
import { getSentAnswers, showForm } from '@/data/form-preview';
import { readFormTemplate, readTableFile } from '@/import/tableau';

import { lireExemple } from '../../../jest/lire-exemple';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const template = readFormTemplate(readTableFile('template-formulaire.xlsx', lireExemple('template-formulaire.xlsx')))!;

describe('FormScreen', () => {
  it('fait apparaître une question selon la réponse et vérifie avant l’envoi', async () => {
    showForm(template);
    await render(<FormScreen />);
    const signataire = template.questions[3].label.split('\n')[0];
    expect(screen.queryByText(signataire, { exact: false })).toBeNull();
    await fireEvent.press(screen.getByText('Non'));
    expect(screen.getByText(signataire, { exact: false })).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(screen.getByText('5 réponses à corriger avant l’envoi.')).toBeOnTheScreen();
    expect(screen.getAllByText('Remplissez tous les champs.')).toHaveLength(2);
    expect(getSentAnswers()).toBeNull();
  });

  it('montre le récapitulatif quand la demande est complète', async () => {
    showForm({ ...template, questions: template.questions.slice(1, 3) });
    await render(<FormScreen />);
    await fireEvent.press(screen.getByLabelText(template.questions[1].label.split('\n')[0]));
    await fireEvent.press(screen.getByText('Cas 2'));
    await fireEvent.press(screen.getByText('Oui'));
    await fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(screen.getByText('Demande prête')).toBeOnTheScreen();
    expect(screen.getByText('Cas 2')).toBeOnTheScreen();
    expect(getSentAnswers()).toEqual({ 2: 'Cas 2', 3: 'Oui' });
  });
});
