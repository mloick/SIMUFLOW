/**
 * Tient les rappels d'échéance à jour : à chaque changement d'une demande
 * suivie, d'un process ou du réglage « Rappels d'échéance », tous les rappels
 * sont reprogrammés (src/tracking/reminders.ts). Toucher un rappel ouvre le
 * suivi de la demande. Appelé une fois, dans src/app/_layout.tsx.
 */

import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { getProcess, useImportedProcesses } from '@/data/process-store';
import { useTrackings } from '@/data/tracking-store';
import { allReminders } from '@/tracking/reminders';

import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleReminders,
  useReminderTaps,
} from './notifications';
import { useRemindersEnabled } from './settings';

export function useDeadlineReminders() {
  const trackings = useTrackings();
  const processes = useImportedProcesses();
  const enabled = useRemindersEnabled();

  useEffect(() => {
    const update = async () => {
      const reminders = enabled ? allReminders(trackings, getProcess, new Date()) : [];
      let permission = await getNotificationPermission();
      // Première demande suivie avec une échéance : c'est le moment de demander l'autorisation.
      if (permission === 'undetermined' && reminders.length > 0) permission = await requestNotificationPermission();
      if (permission === 'granted') await scheduleReminders(reminders);
    };
    update().catch(() => {});
  }, [trackings, processes, enabled]);

  const open = useCallback((id: string) => router.push({ pathname: '/suivi/[id]', params: { id } }), []);
  useReminderTaps(open);
}
