/**
 * Process fictifs affichés tant que l'import et le backend n'existent pas.
 * Certains contiennent des anomalies exprès, pour montrer le diagnostic.
 */

import type { Link, Process, Step } from '@/domain';

/** Écrit les liens en abrégé : [de, vers, libellé ?]. */
function links(prefix: string, list: [string, string, string?][]): Link[] {
  return list.map(([from, to, label], index) => ({ id: `${prefix}-${index + 1}`, from, to, label }));
}

const demandeAccesSteps: Step[] = [
  { id: 'debut', kind: 'start', title: 'Demande d’accès reçue', actor: 'Demandeur' },
  { id: 'verifier', kind: 'task', title: 'Vérifier la demande', actor: 'Service A', duration: 1 },
  { id: 'valide', kind: 'decision', title: 'Accès justifié ?', actor: 'Service A' },
  { id: 'ouvrir', kind: 'task', title: 'Ouvrir l’accès', actor: 'Service A', duration: 1 },
  { id: 'refuser', kind: 'task', title: 'Expliquer le refus', actor: 'Service A' },
  { id: 'fin', kind: 'end', title: 'Demande close' },
];

const incidentSteps: Step[] = [
  { id: 'debut', kind: 'start', title: 'Incident signalé', actor: 'Demandeur' },
  { id: 'qualifier', kind: 'task', title: 'Qualifier l’incident', actor: 'Service A', duration: 1 },
  { id: 'urgent', kind: 'decision', title: 'Urgent ?', actor: 'Service A' },
  { id: 'contourner', kind: 'task', title: 'Mettre en place un contournement', actor: 'Service B', duration: 1 },
  { id: 'diagnostiquer', kind: 'task', title: 'Diagnostiquer', actor: 'Support N2', duration: 2 },
  { id: 'resolu', kind: 'decision', title: 'Résolu ?', actor: 'Support N2' },
  { id: 'escalader', kind: 'task', title: 'Escalader au N3', actor: 'Support N2', duration: 3 },
  { id: 'corriger', kind: 'task', title: 'Appliquer la correction', actor: 'Service B', duration: 1 },
  { id: 'confirme', kind: 'decision', title: 'Demandeur satisfait ?', actor: 'Demandeur' },
  { id: 'fin', kind: 'end', title: 'Incident clos' },
];

const commandeSteps: Step[] = [
  { id: 'debut', kind: 'start', title: 'Besoin exprimé', actor: 'Demandeur' },
  { id: 'devis', kind: 'task', title: 'Demander un devis', actor: 'Achats', duration: 2 },
  { id: 'budget', kind: 'decision', title: 'Budget disponible ?', actor: 'Responsable' },
  { id: 'commander', kind: 'task', title: 'Passer la commande', actor: 'Achats', duration: 1 },
  { id: 'recevoir', kind: 'task', title: 'Recevoir le matériel', actor: 'Achats', duration: 5 },
  { id: 'conforme', kind: 'decision', title: 'Livraison conforme ?', actor: 'Demandeur' },
  { id: 'installer', kind: 'task', title: 'Installer le matériel', actor: 'Demandeur', duration: 1 },
  { id: 'fin', kind: 'end', title: 'Commande close' },
];

const changementSteps: Step[] = [
  { id: 'debut', kind: 'start', title: 'Changement planifié', actor: 'Service B' },
  { id: 'preparer', kind: 'task', title: 'Préparer le changement', actor: 'Service B', duration: 1 },
  { id: 'reussi', kind: 'decision', title: 'Test réussi ?', actor: 'Support N2' },
  { id: 'revenir', kind: 'task', title: 'Revenir en arrière', actor: 'Service B', duration: 1 },
  { id: 'fin', kind: 'end', title: 'Changement terminé' },
];

export const demoProcesses: Process[] = [
  {
    id: 'demande-acces',
    name: 'Demande d’accès',
    source: 'drawio',
    steps: demandeAccesSteps,
    links: links('da', [
      ['debut', 'verifier'],
      ['verifier', 'valide'],
      ['valide', 'ouvrir', 'oui'],
      ['valide', 'refuser', 'non'],
      ['ouvrir', 'fin'],
      ['refuser', 'fin'],
    ]),
  },
  {
    // Deux avertissements : « Escalader au N3 » est une impasse, et une
    // sortie de « Résolu ? » n'a pas de libellé.
    id: 'gestion-incident',
    name: 'Gestion d’un incident',
    source: 'drawio',
    steps: incidentSteps,
    links: links('gi', [
      ['debut', 'qualifier'],
      ['qualifier', 'urgent'],
      ['urgent', 'contourner', 'oui'],
      ['urgent', 'diagnostiquer', 'non'],
      ['contourner', 'diagnostiquer'],
      ['diagnostiquer', 'resolu'],
      ['resolu', 'corriger', 'oui'],
      ['resolu', 'escalader'],
      ['corriger', 'confirme'],
      ['confirme', 'fin', 'oui'],
      ['confirme', 'diagnostiquer', 'non'],
    ]),
  },
  {
    // Une erreur : « Livraison conforme ? » n'a qu'une sortie.
    id: 'commande-materiel',
    name: 'Commande de matériel',
    source: 'scan',
    steps: commandeSteps,
    links: links('cm', [
      ['debut', 'devis'],
      ['devis', 'budget'],
      ['budget', 'commander', 'oui'],
      ['budget', 'fin', 'non'],
      ['commander', 'recevoir'],
      ['recevoir', 'conforme'],
      ['conforme', 'installer', 'oui'],
      ['installer', 'fin'],
    ]),
  },
  {
    id: 'changement-standard',
    name: 'Changement standard',
    source: 'scan',
    steps: changementSteps,
    links: links('cs', [
      ['debut', 'preparer'],
      ['preparer', 'reussi'],
      ['reussi', 'fin', 'oui'],
      ['reussi', 'revenir', 'non'],
      ['revenir', 'fin'],
    ]),
  },
];
