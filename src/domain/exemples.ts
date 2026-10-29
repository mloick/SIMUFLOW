import type { Process } from './types';

/**
 * Process fictif, pour les tests et les écrans de démonstration : une demande de matériel de bureau.
 *
 *   demande → validation ─oui→ commande → livraison → fin
 *                        └non→ refus → fin
 */
export const demandeMateriel: Process = {
  id: 'demande-materiel',
  name: 'Demande de matériel',
  steps: [
    { id: 'demande', kind: 'start', title: 'Demande reçue', actor: 'Employé' },
    { id: 'validation', kind: 'decision', title: 'Demande validée ?', actor: 'Responsable', duration: 2 },
    { id: 'commande', kind: 'task', title: 'Passer la commande', actor: 'Achats', duration: 1 },
    { id: 'livraison', kind: 'task', title: 'Livrer le matériel', actor: 'Logistique', duration: 5 },
    { id: 'refus', kind: 'task', title: 'Prévenir du refus', actor: 'Responsable', duration: 1 },
    { id: 'fin', kind: 'end', title: 'Demande close' },
  ],
  links: [
    { id: 'l1', from: 'demande', to: 'validation' },
    { id: 'l2', from: 'validation', to: 'commande', label: 'oui' },
    { id: 'l3', from: 'validation', to: 'refus', label: 'non' },
    { id: 'l4', from: 'commande', to: 'livraison' },
    { id: 'l5', from: 'livraison', to: 'fin' },
    { id: 'l6', from: 'refus', to: 'fin' },
  ],
};

/** Copie modifiable de l'exemple, pour y créer une anomalie (tests). */
export function copie(): Process {
  return structuredClone(demandeMateriel);
}
