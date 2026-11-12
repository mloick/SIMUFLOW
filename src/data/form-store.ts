/**
 * Formulaires gardés sur ce téléphone (saved-file.ts), avec le workflow qui
 * leur est lié : les situations d'un classeur SLA / OLA, ou un process (schéma
 * draw.io, tableau de process). Un formulaire gardé se rouvre depuis Profil,
 * se remplit, et la réponse au choix de la situation mène au process.
 *
 * Le formulaire en cours d'affichage (`showForm`) vit en mémoire : celui que
 * l'écran d'import vient de lire, ou un formulaire gardé.
 */

import { useSyncExternalStore } from 'react';

import type { Process } from '@/domain';
import type { FormAnswers, FormTemplate, Situation } from '@/import/tableau';

import { readSaved, writeSaved } from './saved-file';

/** Le workflow lié à un formulaire, avec le nom du fichier d'où il vient. */
export type LinkedWorkflow =
  | { kind: 'situations'; source: string; situations: Situation[] }
  | { kind: 'process'; source: string; process: Process };

export type SavedForm = {
  id: string;
  form: FormTemplate;
  /** Fichier du template. */
  source: string;
  savedAt: string;
  workflow: LinkedWorkflow | null;
};

const FILE = 'formulaires';
const FORMAT = 'simuflow-formulaires';

function isSaved(value: unknown): value is SavedForm {
  const saved = value as SavedForm;
  return typeof saved?.id === 'string' && Array.isArray(saved.form?.questions);
}

/** Relit les formulaires gardés ; un fichier abîmé ou inconnu donne une liste vide. */
export function parseSavedForms(text: string | null): SavedForm[] {
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    if (data?.format !== FORMAT || !Array.isArray(data.forms)) return [];
    return data.forms.filter(isSaved).map((saved: SavedForm) => ({ ...saved, workflow: saved.workflow ?? null }));
  } catch {
    return [];
  }
}

function load(): SavedForm[] {
  try {
    return parseSavedForms(readSaved(FILE));
  } catch {
    return [];
  }
}

let forms: SavedForm[] = load();
const listeners = new Set<() => void>();

function setForms(next: SavedForm[]) {
  forms = next;
  listeners.forEach((listener) => listener());
  try {
    writeSaved(JSON.stringify({ format: FORMAT, version: 1, forms: next }), FILE);
  } catch (error) {
    console.warn('Les formulaires n’ont pas pu être enregistrés.', error);
  }
}

export function getSavedForms(): SavedForm[] {
  return forms;
}

export function getSavedForm(id: string): SavedForm | undefined {
  return forms.find((saved) => saved.id === id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSavedForms(): SavedForm[] {
  return useSyncExternalStore(subscribe, getSavedForms, getSavedForms);
}

/** Garde un formulaire (et son workflow) ; renvoie son identifiant. */
export function saveForm(form: FormTemplate, source: string, workflow: LinkedWorkflow | null, now = new Date()): string {
  const id = `formulaire-${now.getTime()}`;
  setForms([{ id, form, source, savedAt: now.toISOString(), workflow }, ...forms]);
  return id;
}

/** Lie (ou délie, avec `null`) un workflow à un formulaire gardé. */
export function linkWorkflow(id: string, workflow: LinkedWorkflow | null) {
  setForms(forms.map((saved) => (saved.id === id ? { ...saved, workflow } : saved)));
}

export function removeSavedForm(id: string) {
  setForms(forms.filter((saved) => saved.id !== id));
}

// ---------------------------------------------------------------------------
// Formulaire affiché

export type ShownForm = {
  form: FormTemplate;
  source: string;
  workflow: LinkedWorkflow | null;
  /** Identifiant du formulaire gardé, s'il l'est. */
  savedId: string | null;
  /** Clé des process créés depuis ce formulaire, pour ne pas les recréer à chaque demande. */
  key: string;
};

let shown: ShownForm | null = null;
let sent: FormAnswers | null = null;

/** Le formulaire à afficher : lu à l'import (avec son workflow s'il est dans le même classeur) ou gardé. */
export function showForm(form: FormTemplate, options: { source?: string; workflow?: LinkedWorkflow | null; savedId?: string | null } = {}) {
  shown = {
    form,
    source: options.source ?? '',
    workflow: options.workflow ?? null,
    savedId: options.savedId ?? null,
    key: options.savedId ?? `apercu-${Date.now()}`,
  };
  sent = null;
}

/** Rouvre un formulaire gardé. */
export function showSavedForm(saved: SavedForm) {
  showForm(saved.form, { source: saved.source, workflow: saved.workflow, savedId: saved.id });
}

export function getShownForm(): ShownForm | null {
  return shown;
}

/** Garde les réponses d'une demande prête (sans les questions cachées). */
export function keepSentAnswers(answers: FormAnswers): void {
  sent = answers;
}

export function getSentAnswers(): FormAnswers | null {
  return sent;
}
