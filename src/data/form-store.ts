/**
 * Formulaires gardés sur ce téléphone (saved-file.ts), avec le workflow qui
 * leur est lié : les situations d'un classeur SLA / OLA, ou un process (schéma
 * draw.io, tableau de process). Un formulaire gardé se rouvre depuis Profil,
 * se remplit, et la réponse au choix de la situation mène au process.
 *
 * Connecté, ils sont aussi gardés sur le compte (syncSavedForms, lancée par
 * cloud-sync.ts) : `pending` marque un changement pas encore envoyé, et
 * `removed` les formulaires retirés ici, à retirer aussi du serveur.
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
  /** Dernière modification (date ISO) : entre deux appareils, la plus récente gagne. Sinon `savedAt`. */
  updatedAt?: string;
  /** Déjà envoyé au compte. */
  cloud?: boolean;
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

type FormsState = { forms: SavedForm[]; pending: boolean; removed: string[] };

function load(): FormsState {
  try {
    const text = readSaved(FILE);
    const data = JSON.parse(text ?? 'null');
    const saved = parseSavedForms(text);
    const removed = Array.isArray(data?.removed) ? data.removed.filter((id: unknown) => typeof id === 'string') : [];
    // Version 1 (avant le compte) : tout est encore à envoyer.
    return { forms: saved, pending: data?.version === 1 ? saved.length > 0 : data?.pending === true, removed };
  } catch {
    return { forms: [], pending: false, removed: [] };
  }
}

let state: FormsState = load();
let forms: SavedForm[] = state.forms;
const listeners = new Set<() => void>();

function setState(next: FormsState) {
  state = next;
  forms = next.forms;
  listeners.forEach((listener) => listener());
  try {
    writeSaved(JSON.stringify({ format: FORMAT, version: 2, ...next }), FILE);
  } catch (error) {
    console.warn('Les formulaires n’ont pas pu être enregistrés.', error);
  }
}

/** Un changement fait par l'utilisateur : il partira au compte. */
function setForms(next: SavedForm[], removed: string[] = []) {
  setState({ forms: next, pending: true, removed: [...state.removed, ...removed] });
}

/** Marque une modification : toujours plus récente que la version modifiée, même si l'horloge d'un appareil avance. */
function touch(saved: SavedForm, now = new Date()): SavedForm {
  const previous = Date.parse(saved.updatedAt ?? saved.savedAt);
  const at = Number.isNaN(previous) ? now.getTime() : Math.max(now.getTime(), previous + 1);
  return { ...saved, updatedAt: new Date(at).toISOString() };
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
  const savedAt = now.toISOString();
  setForms([{ id, form, source, savedAt, updatedAt: savedAt, workflow }, ...forms]);
  return id;
}

/** Lie (ou délie, avec `null`) un workflow à un formulaire gardé. */
export function linkWorkflow(id: string, workflow: LinkedWorkflow | null) {
  setForms(forms.map((saved) => (saved.id === id ? touch({ ...saved, workflow }) : saved)));
}

/** Remplace le formulaire d'un formulaire gardé (après modification). */
export function updateSavedForm(id: string, form: FormTemplate) {
  setForms(forms.map((saved) => (saved.id === id ? touch({ ...saved, form }) : saved)));
}

export function removeSavedForm(id: string) {
  const removed = forms.find((saved) => saved.id === id);
  setForms(
    forms.filter((saved) => saved.id !== id),
    removed?.cloud ? [id] : [],
  );
}

// ---------------------------------------------------------------------------
// Compte

/** Un changement attend d'être envoyé au compte. */
export function hasPendingForms(): boolean {
  return state.pending;
}

export function subscribeSavedForms(listener: () => void) {
  return subscribe(listener);
}

const stamp = (saved: SavedForm) => saved.updatedAt ?? saved.savedAt;

/**
 * Accorde les formulaires du téléphone et ceux du compte, formulaire par
 * formulaire :
 * - présent des deux côtés : le plus récemment modifié gagne ;
 * - seulement sur le compte : il arrive sur le téléphone, sauf s'il vient d'y être retiré ;
 * - seulement sur le téléphone : il part au compte s'il est nouveau ; déjà
 *   envoyé, c'est qu'il a été retiré sur un autre appareil, il disparaît.
 * Le résultat garde l'ordre du téléphone, les formulaires arrivés du compte devant.
 */
export function reconcileForms(server: SavedForm[], local: SavedForm[], removed: string[]): SavedForm[] {
  const fromServer = new Map(server.map((saved) => [saved.id, saved]));
  const gone = new Set(removed);
  const localIds = new Set(local.map((saved) => saved.id));
  const arrived = server.filter((saved) => !localIds.has(saved.id) && !gone.has(saved.id));
  const kept = local.flatMap((saved) => {
    const other = fromServer.get(saved.id);
    if (!other) return saved.cloud ? [] : [saved];
    return [stamp(other) > stamp(saved) ? other : saved];
  });
  return [...arrived, ...kept].map((saved) => ({ ...saved, cloud: true }));
}

/** Ce qui part au compte : sans la marque `cloud`, propre au téléphone. */
const forCloud = (list: SavedForm[]) => list.map(({ cloud: _cloud, ...saved }) => saved);

export type FormsApi = {
  get: () => Promise<SavedForm[]>;
  save: (forms: SavedForm[]) => Promise<void>;
};

/** Accorde les formulaires avec le compte. Un changement fait pendant l'envoi partira à la synchronisation suivante. */
export async function syncSavedForms(api: FormsApi): Promise<void> {
  const before = state;
  const server = parseSavedForms(JSON.stringify({ format: FORMAT, forms: await api.get() }));
  const next = reconcileForms(server, before.forms, before.removed);
  if (JSON.stringify(forCloud(next)) !== JSON.stringify(server)) await api.save(forCloud(next));
  if (state !== before) return; // modifié pendant l'envoi : on repassera
  setState({ forms: next, pending: false, removed: [] });
}

/** Plus de compte : les formulaires déjà sur le compte quittent le téléphone ; ceux pas encore envoyés restent. */
export function forgetCloudForms() {
  const kept = forms.filter((saved) => !saved.cloud);
  if (kept.length !== forms.length) setState({ forms: kept, pending: state.pending, removed: [] });
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
const shownListeners = new Set<() => void>();
const notifyShown = () => shownListeners.forEach((listener) => listener());

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
  notifyShown();
}

/**
 * Le formulaire affiché, modifié dans l'éditeur. Gardé, il est aussi mis à
 * jour dans « Mes formulaires ». Une nouvelle clé : les process créés depuis
 * l'ancienne version ne sont pas repris.
 */
export function editShownForm(form: FormTemplate) {
  if (!shown) return;
  shown = { ...shown, form, key: `${shown.savedId ?? 'apercu'}-${Date.now()}` };
  sent = null;
  if (shown.savedId) updateSavedForm(shown.savedId, form);
  notifyShown();
}

function subscribeShown(listener: () => void) {
  shownListeners.add(listener);
  return () => {
    shownListeners.delete(listener);
  };
}

/** Le formulaire affiché vient d'être gardé : ses modifications suivantes iront aussi dans « Mes formulaires ». */
export function markShownSaved(id: string) {
  if (shown) shown = { ...shown, savedId: id };
}

/** Le formulaire affiché, mis à jour quand il change. */
export function useShownForm(): ShownForm | null {
  return useSyncExternalStore(subscribeShown, getShownForm, getShownForm);
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
