/**
 * Alertes du partage (src/domain/share-alerts.ts) : cherchées à chaque
 * synchronisation (cloud-sync.ts), gardées sur le téléphone (localStorage) pour
 * l'écran « Alertes », et envoyées en notification sur iOS et Android si le
 * réglage « Alertes du partage » est actif et que le téléphone l'autorise.
 * Sans compte, elles sont oubliées : le compte suivant repart de zéro.
 */

import { useSyncExternalStore } from 'react';

import '@/backend/local-storage';
import { listSharingActivity } from '@/backend/sharing';
import { detectShareAlerts, type ShareAlert, type ShareAlertState, type ShareSnapshot } from '@/domain';
import { getNotificationPermission, notifyNow } from '@/notifications/notifications';
import { areShareAlertsEnabled } from '@/notifications/settings';

import { getImportEntries } from './process-store';
import { getSharedProcesses } from './shared-store';

const STATE_KEY = 'simuflow.alertes-etat';
const LIST_KEY = 'simuflow.alertes';
/** Les plus anciennes alertes partent au-delà. */
const MAX_ALERTS = 30;

type Saved = { alerts: ShareAlert[]; seenAt: string | null };

function readJson<T>(key: string): T | null {
  try {
    const text = globalThis.localStorage?.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Gardé pour cette session seulement.
  }
}

const listeners = new Set<() => void>();
let saved: Saved = (() => {
  const data = readJson<Saved>(LIST_KEY);
  return data && Array.isArray(data.alerts) ? data : { alerts: [], seenAt: null };
})();

function setSaved(next: Saved) {
  saved = next;
  writeJson(LIST_KEY, next.alerts.length || next.seenAt ? next : null);
  listeners.forEach((listener) => listener());
}

/** Ce que l'app voit maintenant : les partages reçus, et mes process partagés avec leurs membres et avis. */
async function snapshot(): Promise<ShareSnapshot> {
  const mine = getImportEntries().filter((entry) => entry.cloudId && !entry.deleted);
  const activity = await listSharingActivity(mine.map((entry) => entry.cloudId!));
  return {
    shared: getSharedProcesses().map((item) => ({
      cloudId: item.cloudId,
      localId: item.process.id,
      name: item.process.name,
      ownerName: item.ownerName,
    })),
    owned: mine
      .map((entry) => ({
        cloudId: entry.cloudId!,
        localId: entry.process.id,
        process: entry.process,
        members: activity.members
          .filter((member) => member.process_id === entry.cloudId)
          .map((member) => ({ id: member.member_id, actor: member.actor })),
        reviews: activity.reviews.filter((review) => review.processId === entry.cloudId),
      }))
      .filter((item) => item.members.length > 0),
  };
}

const pathOf = (alert: ShareAlert) => alert.target.pathname.replace('[id]', encodeURIComponent(alert.target.id));

/** Cherche les nouvelles alertes ; un échec (réseau, script pas appliqué) ne change rien. */
export async function checkShareAlerts(now = new Date()): Promise<ShareAlert[]> {
  try {
    const previous = readJson<ShareAlertState>(STATE_KEY);
    const { alerts, state } = detectShareAlerts(previous, await snapshot(), now);
    writeJson(STATE_KEY, state);
    if (alerts.length === 0) return [];
    setSaved({ ...saved, alerts: [...alerts.reverse(), ...saved.alerts].slice(0, MAX_ALERTS) });
    if (areShareAlertsEnabled() && (await getNotificationPermission()) === 'granted') {
      await Promise.all(alerts.map((alert) => notifyNow({ ...alert, path: pathOf(alert) }).catch(() => {})));
    }
    return alerts;
  } catch (error) {
    if (__DEV__) console.warn('Alertes du partage :', error);
    return [];
  }
}

/** Plus de compte : on oublie les alertes et ce qui a été vu. */
export function forgetShareAlerts() {
  writeJson(STATE_KEY, null);
  if (saved.alerts.length || saved.seenAt) setSaved({ alerts: [], seenAt: null });
}

/** L'écran « Alertes » a été ouvert : plus rien de nouveau. */
export function markShareAlertsSeen(now = new Date()) {
  if (saved.alerts.some((alert) => !saved.seenAt || alert.at > saved.seenAt)) {
    setSaved({ ...saved, seenAt: now.toISOString() });
  }
}

export function useShareAlerts(): { alerts: ShareAlert[]; unread: number } {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => saved,
    () => saved,
  );
  const unread = current.alerts.filter((alert) => !current.seenAt || alert.at > current.seenAt).length;
  return { alerts: current.alerts, unread };
}

export { pathOf as shareAlertPath };
