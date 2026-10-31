/**
 * Version web : les notifications du téléphone n'existent pas dans le
 * navigateur. L'écran Profil le dit.
 */

import type { Reminder } from '@/tracking/reminders';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export const DEADLINE_CHANNEL = 'echeances';
export const TEST_DELAY_SECONDS = 5;

export function configureNotifications() {}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  return 'unavailable';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return 'unavailable';
}

export async function sendTestNotification() {}

export async function cancelAllNotifications() {}

export async function scheduleReminders(_reminders: Reminder[]) {}

export function useReminderTaps(_open: (trackingId: string) => void) {}
