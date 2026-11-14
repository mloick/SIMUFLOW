/**
 * Langue de l'app : français ou anglais. Le réglage « Langue » du Profil vaut
 * automatique (la langue du téléphone : français s'il est en français, anglais
 * sinon), français ou anglais. Gardé sur le téléphone (localStorage).
 *
 * Les textes sont dans messages/fr.ts (la référence) et messages/en.ts, qui a
 * exactement les mêmes clés : TypeScript refuse une traduction manquante.
 * Dans un écran : `const t = useT();` puis `t.profil.title`. Hors d'un écran
 * (messages d'erreur, notifications) : `getT()`.
 *
 * Attention, le React Compiler mémorise ce qu'un écran calcule : dans un écran,
 * prendre toujours les textes de `useT()` (et les passer aux fonctions d'aide),
 * jamais `getT()`, sinon le texte ne change pas avec la langue.
 */

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import '@/backend/local-storage';
import { deviceLanguage } from '@/i18n/device-locale';

import { en } from './messages/en';
import { fr, type Messages } from './messages/fr';

export type { Messages };
export type Language = 'fr' | 'en';
export type LanguageSetting = 'auto' | Language;

export const LANGUAGE_SETTINGS: LanguageSetting[] = ['auto', 'fr', 'en'];

const KEY = 'simuflow.langue';
const CATALOGS: Record<Language, Messages> = { fr, en };
const listeners = new Set<() => void>();

/** Automatique : français si le téléphone est en français, anglais sinon. */
export function resolveLanguage(setting: LanguageSetting, device: string): Language {
  if (setting !== 'auto') return setting;
  return device.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function read(): LanguageSetting {
  try {
    const value = globalThis.localStorage?.getItem(KEY);
    return value === 'fr' || value === 'en' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

let setting = read();
let language = resolveLanguage(setting, deviceLanguage());

/** Dans le navigateur, la page annonce sa langue (lecteurs d'écran, traduction). */
function applyToPage() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = language;
}
applyToPage();

export function getLanguageSetting(): LanguageSetting {
  return setting;
}

export function getLanguage(): Language {
  return language;
}

export function setLanguageSetting(next: LanguageSetting) {
  setting = next;
  language = resolveLanguage(next, deviceLanguage());
  applyToPage();
  try {
    if (next === 'auto') globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, next);
  } catch {
    // Le réglage vaut pour cette session seulement.
  }
  listeners.forEach((listener) => listener());
}

/** Les textes dans la langue actuelle, hors d'un écran. */
export function getT(): Messages {
  return CATALOGS[language];
}

/** Pour les dates et les heures : « fr-FR » ou « en-GB ». */
export function getLocale(): string {
  return getT().common.locale;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLanguageSetting(): LanguageSetting {
  return useSyncExternalStore(
    subscribe,
    () => setting,
    () => setting,
  );
}

export function useLanguage(): Language {
  return useSyncExternalStore(
    subscribe,
    () => language,
    () => language,
  );
}

/** Les textes dans la langue actuelle ; l'écran se redessine quand la langue change. */
export function useT(): Messages {
  return CATALOGS[useLanguage()];
}
