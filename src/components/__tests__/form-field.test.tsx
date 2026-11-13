/**
 * Test de composant : une question du formulaire, dessinée selon son type
 * (aperçu d'un template de formulaire).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { conditionText, FormField } from '@/components/form-field';
import type { FormQuestion } from '@/import/tableau';

const question = (overrides: Partial<FormQuestion>): FormQuestion => ({
  n: 1,
  label: 'Question',
  type: 'text',
  typeText: '',
  mandatory: false,
  explanation: null,
  options: [],
  fields: [],
  documents: [],
  help: null,
  example: null,
  conditions: [],
  conditionText: null,
  cell: 'C3',
  ...overrides,
});

describe('FormField', () => {
  it('marque une question obligatoire et écrit son aide', async () => {
    await render(
      <FormField
        question={question({ label: 'Nom', mandatory: true, help: 'Votre nom complet', example: 'Dupont' })}
        questions={[]}
        value={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Votre nom complet')).toBeOnTheScreen();
    expect(screen.getByText('*', { exact: false })).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Dupont')).toBeOnTheScreen();
  });

  it('ouvre un menu déroulant et choisit une réponse', async () => {
    const onChange = jest.fn();
    await render(
      <FormField question={question({ label: 'Situation', type: 'select', options: ['Cas 1', 'Cas 2'] })} questions={[]} value={undefined} onChange={onChange} />,
    );
    await fireEvent.press(screen.getByLabelText('Situation'));
    await fireEvent.press(screen.getByText('Cas 2'));
    expect(onChange).toHaveBeenCalledWith('Cas 2');
  });

  it('ne garde qu’un choix quand une seule case peut être cochée', async () => {
    const onChange = jest.fn();
    await render(
      <FormField
        question={question({ label: 'Lien', type: 'checkbox', single: true, options: ['Filiale', 'Fusion', 'Autre'] })}
        questions={[]}
        value={['Filiale']}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Un seul choix possible')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await fireEvent.press(screen.getByText('Fusion'));
    expect(onChange).toHaveBeenLastCalledWith(['Fusion']);
    await fireEvent.press(screen.getByText('Filiale'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('coche et décoche des cases', async () => {
    const onChange = jest.fn();
    await render(
      <FormField
        question={question({ label: 'Changement', type: 'checkbox', options: ['MOTIF 1 : Adresse', 'MOTIF 2 : Contact'] })}
        questions={[]}
        value={['MOTIF 1 : Adresse']}
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByText('MOTIF 2 : Contact'));
    expect(onChange).toHaveBeenCalledWith(['MOTIF 1 : Adresse', 'MOTIF 2 : Contact']);
    await fireEvent.press(screen.getByText('MOTIF 1 : Adresse'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('montre les champs d’un libellé et les documents d’une pièce jointe', async () => {
    await render(
      <>
        <FormField question={question({ label: 'Contact', type: 'label', fields: ['Nom', 'Téléphone'] })} questions={[]} value={undefined} onChange={() => {}} />
        <FormField
          question={question({ n: 2, label: 'Justificatif', type: 'attachment', documents: ['Pièce d’identité'] })}
          questions={[]}
          value={undefined}
          onChange={() => {}}
        />
      </>,
    );
    expect(screen.getByLabelText('Contact : Téléphone')).toBeOnTheScreen();
    expect(screen.getByText('Ajouter un fichier')).toBeOnTheScreen();
    expect(screen.getByText('• Pièce d’identité')).toBeOnTheScreen();
  });

  it('dit quand une question ne s’affiche que sous condition', async () => {
    const questions = [
      question({ n: 1, label: 'Êtes-vous le signataire ?', type: 'yesno' }),
      question({ n: 2, label: 'Si NON : signataire', conditions: [{ question: 1, equals: 'Non' }] }),
    ];
    expect(conditionText(questions[1], questions)).toBe('« Êtes-vous le signataire ? » = Non');
    expect(conditionText(questions[0], questions)).toBeNull();
    await render(<FormField question={questions[1]} questions={questions} value={undefined} onChange={() => {}} />);
    expect(screen.getByText('S’affiche si « Êtes-vous le signataire ? » = Non')).toBeOnTheScreen();
  });

  it('écrit l’erreur d’une réponse et retire un fichier joint', async () => {
    const onChange = jest.fn();
    await render(
      <FormField
        question={question({ label: 'Justificatif', type: 'attachment', mandatory: true })}
        questions={[]}
        value={['facture.pdf', 'photo.jpg']}
        onChange={onChange}
        error="Ajoutez au moins un fichier."
      />,
    );
    expect(screen.getByText('Ajoutez au moins un fichier.')).toBeOnTheScreen();
    expect(screen.getByText('Ajouter un autre fichier')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Retirer facture.pdf'));
    expect(onChange).toHaveBeenCalledWith(['photo.jpg']);
  });
});
