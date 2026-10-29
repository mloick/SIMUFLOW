/**
 * Types du cœur du simulateur. Un process est un graphe : des étapes reliées
 * par des liens orientés. Ces types ne dépendent ni de l'écran ni du format
 * d'import (draw.io, JSON, tableau scanné).
 */

/** Rôle d'une étape dans le process. */
export type StepKind = 'start' | 'task' | 'decision' | 'end';

export type Step = {
  id: string;
  kind: StepKind;
  title: string;
  /** Personne ou équipe qui réalise l'étape. */
  actor?: string;
  /** Délai de l'étape, en jours ouvrés. */
  duration?: number;
  /** Position et taille sur le schéma d'origine (import draw.io). */
  layout?: { x: number; y: number; width: number; height: number };
};

/** Lien orienté d'une étape vers la suivante. */
export type Link = {
  id: string;
  from: string;
  to: string;
  /** Libellé de la branche, par exemple « oui » ou « non » après une décision. */
  label?: string;
};

/** D'où vient le process : schéma draw.io, tableau scanné ou fichier JSON. */
export type ProcessSource = 'drawio' | 'scan' | 'json';

export type Process = {
  id: string;
  name: string;
  source?: ProcessSource;
  steps: Step[];
  links: Link[];
};
