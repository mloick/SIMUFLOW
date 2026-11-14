/**
 * Réglages des notifications de l'onglet Profil, gardés sur le téléphone
 * (localStorage, base SQLite du téléphone sur iOS et Android). Activés par
 * défaut : sans l'autorisation du système, rien ne s'affiche de toute façon.
 *
 * - « Rappels d'échéance » : les échéances des demandes suivies ;
 * - « Alertes du partage » : nouveau partage, étape à revoir, process validé.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';

function createSwitch(key: string) {
  const listeners = new Set<() => void>();
  let enabled = (() => {
    try {
      return globalThis.localStorage?.getItem(key) !== 'off';
    } catch {
      return true;
    }
  })();

  const get = () => enabled;
  const set = (next: boolean) => {
    enabled = next;
    try {
      globalThis.localStorage?.setItem(key, next ? 'on' : 'off');
    } catch {
      // Le réglage vaut pour cette session seulement.
    }
    listeners.forEach((listener) => listener());
  };
  const use = () =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => enabled,
      () => true,
    );
  return { get, set, use };
}

const reminders = createSwitch('simuflow.notifications');
const shareAlerts = createSwitch('simuflow.alertes-partage');

export const areRemindersEnabled = reminders.get;
export const setRemindersEnabled = reminders.set;
export const useRemindersEnabled = reminders.use;

export const areShareAlertsEnabled = shareAlerts.get;
export const setShareAlertsEnabled = shareAlerts.set;
export const useShareAlertsEnabled = shareAlerts.use;
