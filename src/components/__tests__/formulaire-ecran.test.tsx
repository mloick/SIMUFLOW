/**
 * Test d'écran : remplir le formulaire d'un template, voir les questions
 * conditionnelles apparaître, être arrêté par une réponse manquante, puis
 * obtenir le récapitulatif de la demande.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FormScreen from '@/app/formulaire';
import { getSentAnswers, showForm } from '@/data/form-store';
import { getProcess } from '@/data/process-store';
import { readFormTemplate, readTableFile, workbookToSituations } from '@/import/tableau';

import { lireExemple } from '../../../jest/lire-exemple';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
// La suite du formulaire écrit dans les process et les suivis : en mémoire pour le test.
jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: () => {} }));
jest.mock('@/data/tracking-store', () => ({ saveTracking: jest.fn() }));
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
    expect(screen.getByText('6 réponses à corriger avant l’envoi.')).toBeOnTheScreen();
    expect(screen.getByText('Remplissez les champs, dont au moins l’un de ceux-ci : N° de dossier ou N° de contrat.')).toBeOnTheScreen();
    expect(screen.getByText('Remplissez tous les champs.')).toBeOnTheScreen();
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

  it('mène la situation choisie à son process quand le workflow est lié', async () => {
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router');
    const linked = readTableFile('formulaire-et-workflow.xlsx', lireExemple('formulaire-et-workflow.xlsx'));
    const form = readFormTemplate(linked)!;
    const { situations } = workbookToSituations(linked);
    showForm({ ...form, questions: form.questions.slice(1, 3) }, { source: 'f.xlsx', workflow: { kind: 'situations', source: 'f.xlsx', situations } });
    await render(<FormScreen />);
    expect(screen.getByText('6 situations. La réponse à « Situation » choisit le process qui suit la demande (6 choix reliés).')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Situation'));
    await fireEvent.press(screen.getByText('Cas 3'));
    await fireEvent.press(screen.getByText('Oui'));
    await fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(screen.getByText('Famille X · Cas 3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Simuler le parcours'));
    const id = (router.push.mock.calls.at(-1)?.[0] as { params: { id: string } }).params.id;
    expect(getProcess(id)?.name).toBe('Famille X · Cas 3');
  });

  it('un formulaire seul s’arrête à l’envoi', async () => {
    showForm({ ...template, questions: template.questions.slice(1, 3) });
    await render(<FormScreen />);
    expect(screen.getByText('Formulaire seul')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Situation'));
    await fireEvent.press(screen.getByText('Cas 1'));
    await fireEvent.press(screen.getByText('Oui'));
    await fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(screen.getByText(/la simulation s’arrête ici/)).toBeOnTheScreen();
    expect(screen.queryByText('Simuler le parcours')).toBeNull();
  });
});
