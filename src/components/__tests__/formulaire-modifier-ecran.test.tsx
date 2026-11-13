/**
 * Test d'écran : modifier le formulaire lu dans un template (renommer une
 * question, en supprimer une, en ajouter une), puis enregistrer : le
 * formulaire affiché est remplacé.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import FormEditorScreen from '@/app/formulaire-modifier';
import { getShownForm, showForm } from '@/data/form-store';
import { readFormTemplate, readTableFile } from '@/import/tableau';

import { lireExemple } from '../../../jest/lire-exemple';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  // Les boutons de l'en-tête (Annuler, Enregistrer) sont rendus dans l'écran pour le test.
  Stack: {
    Screen: ({ options }: { options: { headerLeft?: () => ReactNode; headerRight?: () => ReactNode } }) => (
      <>
        {options.headerLeft?.()}
        {options.headerRight?.()}
      </>
    ),
  },
}));
jest.mock('@/data/saved-file', () => ({ readSaved: () => null, writeSaved: () => {} }));
jest.mock('@/utils/confirm', () => ({
  confirmAction: (_title: string, _message: string, _label: string, onConfirm: () => void) => onConfirm(),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const template = readFormTemplate(readTableFile('template-formulaire.xlsx', lireExemple('template-formulaire.xlsx')))!;

describe('FormEditorScreen', () => {
  it('renomme, supprime et ajoute des questions, puis enregistre', async () => {
    showForm(template, { source: 'template-formulaire.xlsx' });
    await render(<FormEditorScreen />);
    expect(screen.getByText(`${template.questions.length} questions`, { exact: false })).toBeOnTheScreen();

    // Renommer la question 2.
    await fireEvent.press(screen.getAllByText('Modifier')[1]);
    await fireEvent.changeText(screen.getByLabelText('Intitulé de la question'), 'Votre situation');
    await fireEvent(screen.getByLabelText('Réponse obligatoire'), 'valueChange', false);
    await fireEvent.press(screen.getByText('Fermer'));

    // Supprimer la question 12 (Date souhaitée).
    await fireEvent.press(screen.getAllByText('Modifier')[11]);
    await fireEvent.press(screen.getByText('Supprimer'));

    // Ajouter une pièce jointe à la fin.
    await fireEvent.press(screen.getByText('Ajouter une question à la fin'));
    await fireEvent.changeText(screen.getByLabelText('Intitulé de la question'), 'Procuration');
    await fireEvent.press(screen.getByRole('radio', { name: 'Pièce jointe' }));

    await fireEvent.press(screen.getByText('Enregistrer'));
    const form = getShownForm()!.form;
    expect(form.questions).toHaveLength(template.questions.length);
    expect(form.questions[1]).toMatchObject({ label: 'Votre situation', mandatory: false });
    expect(form.questions.some((question) => question.label === 'Date souhaitée')).toBe(false);
    expect(form.questions.at(-1)).toMatchObject({ label: 'Procuration', type: 'attachment' });
  });

  it('complète une question oui / non par une pièce jointe, en retrait sous elle', async () => {
    showForm(template, { source: 'template-formulaire.xlsx' });
    await render(<FormEditorScreen />);
    // Question 3 : « Êtes-vous le signataire du dossier ? » (oui / non).
    await fireEvent.press(screen.getAllByText('Modifier')[2]);
    expect(screen.getByText('Ajouter une précision écrite')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ajouter une pièce jointe'));
    expect(screen.getByText('↳ complément de 3', { exact: false })).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Enregistrer'));
    const form = getShownForm()!.form;
    expect(form.questions[3]).toMatchObject({ label: 'Pièce jointe', type: 'attachment', partOf: 3, mandatory: false });
    expect(form.questions).toHaveLength(template.questions.length + 1);
  });

  it('règle des cases à cocher sur un seul choix', async () => {
    showForm(template, { source: 'template-formulaire.xlsx' });
    await render(<FormEditorScreen />);
    // Question 5 : « Quel changement souhaitez-vous ? » (cases à cocher).
    await fireEvent.press(screen.getAllByText('Modifier')[4]);
    await fireEvent(screen.getByLabelText('Plusieurs choix possibles'), 'valueChange', false);
    expect(screen.getByText('Une seule case peut être cochée.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(getShownForm()!.form.questions[4]).toMatchObject({ type: 'checkbox', single: true });
  });

  it('choisit les champs dont un seul suffit', async () => {
    showForm(template, { source: 'template-formulaire.xlsx' });
    await render(<FormEditorScreen />);
    // Question 1 : « Coordonnées du demandeur », lue avec « N° de dossier et/ou N° de contrat ».
    await fireEvent.press(screen.getAllByText('Modifier')[0]);
    expect(screen.getByLabelText('Au moins un : N° de dossier')).toBeChecked();
    await fireEvent.press(screen.getByLabelText('Au moins un : N° de contrat'));
    await fireEvent.press(screen.getByLabelText('Au moins un : Téléphone'));
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(getShownForm()!.form.questions[0].atLeastOne).toEqual([['N° de dossier', 'Téléphone']]);
  });
});
