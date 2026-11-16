/**
 * Test de composant : les branches en parallèle dans la carte de la Simulation.
 * On l'affiche comme sur le téléphone, puis on le lit et on le touche comme un
 * utilisateur.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ParallelBranches } from '@/components/parallel-branches';
import type { Process } from '@/domain';
import { createSimulation } from '@/simulation/engine';

const commande: Process = {
  id: 'commande',
  name: 'Commande',
  steps: [
    { id: 'debut', kind: 'start', title: 'Commande validée' },
    { id: 'partage', kind: 'parallel', title: 'En parallèle' },
    { id: 'facture', kind: 'task', title: 'Préparer la facture', actor: 'Comptabilité', duration: 1 },
    { id: 'colis', kind: 'task', title: 'Préparer le colis', actor: 'Logistique', duration: 3 },
    { id: 'jonction', kind: 'parallel', title: 'Tout est prêt' },
    { id: 'fin', kind: 'end', title: 'Expédiée' },
  ],
  links: [
    { id: 'l1', from: 'debut', to: 'partage' },
    { id: 'l2', from: 'partage', to: 'facture' },
    { id: 'l3', from: 'partage', to: 'colis' },
    { id: 'l4', from: 'facture', to: 'jonction' },
    { id: 'l5', from: 'colis', to: 'jonction' },
    { id: 'l6', from: 'jonction', to: 'fin' },
  ],
};

describe('ParallelBranches', () => {
  const sim = createSimulation(commande);
  const split = sim.step(sim.start(), 'l1');

  it('montre une ligne par branche, et avance celle que l’on touche', async () => {
    const onStep = jest.fn();
    await render(<ParallelBranches sim={sim} state={split} onStep={onStep} />);

    expect(screen.getByText('Préparer la facture')).toBeOnTheScreen();
    expect(screen.getByText('Préparer le colis')).toBeOnTheScreen();
    expect(screen.getByText('Comptabilité')).toBeOnTheScreen();
    expect(screen.getByText('Logistique')).toBeOnTheScreen();

    fireEvent.press(screen.getAllByRole('button', { name: 'Étape suivante : Tout est prêt' })[1]);
    expect(onStep).toHaveBeenCalledWith('l5');
  });

  it('dit ce que la jonction attend encore', async () => {
    await render(<ParallelBranches sim={sim} state={sim.step(split, 'l4')} onStep={() => {}} />);

    expect(screen.getByText('« Tout est prêt » attend encore : Préparer le colis')).toBeOnTheScreen();
    expect(screen.queryByText('Préparer la facture')).toBeNull();
  });
});
