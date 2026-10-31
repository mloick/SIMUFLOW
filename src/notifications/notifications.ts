/**
 * Notifications locales de SimuFlow : programmées par le téléphone lui-même,
 * sans serveur (expo-notifications). Elles serviront aux rappels d'échéance
 * des process suivis.
 *
 * Pas de notification « push » venue d'un serveur : sur iPhone, il faudrait un
 * compte Apple Developer payant (le plugin est configuré avec
 * `enableRemoteNotifications: false` dans app.json).
 */

import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { Reminder } from '@/tracking/reminders';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Canal Android des rappels (réglable par l'utilisateur dans les réglages du téléphone). */
export const DEADLINE_CHANNEL = 'echeances';

/** À appeler une fois au démarrage : affiche les notifications même quand l'app est ouverte. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(DEADLINE_CHANNEL, {
      name: 'Échéances des process',
      description: 'Rappels avant et après l’échéance de chaque étape d’un process suivi.',
      importance: AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

const toPermission = (status: Notifications.NotificationPermissionsStatus): NotificationPermission => {
  if (status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
};

/** L'autorisation actuelle, sans rien demander. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Demande l'autorisation (la fenêtre du système ne s'affiche qu'une fois). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return toPermission(await Notifications.requestPermissionsAsync());
}

/** Délai de la notification d'essai : le temps de verrouiller le téléphone. */
export const TEST_DELAY_SECONDS = 5;

/** Programme une notification d'essai dans quelques secondes. */
export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SimuFlow',
      body: 'Les notifications marchent : vous serez prévenu des échéances de vos process suivis.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_DELAY_SECONDS,
      channelId: DEADLINE_CHANNEL,
    },
  });
}

/** Retire toutes les notifications programmées (quand l'utilisateur coupe les rappels). */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Marque des rappels d'échéance, pour les retrouver parmi les notifications programmées. */
const REMINDER_KIND = 'echeance';

/** Remplace les rappels d'échéance programmés par `reminders` (les autres notifications restent). */
export async function scheduleReminders(reminders: Reminder[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === REMINDER_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
  await Promise.all(
    reminders.map((reminder) =>
      Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { kind: REMINDER_KIND, trackingId: reminder.trackingId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.date,
          channelId: DEADLINE_CHANNEL,
        },
      }),
    ),
  );
}

/** Appelle `open(trackingId)` quand l'utilisateur touche un rappel (aussi au lancement de l'app par un rappel). */
export function useReminderTaps(open: (trackingId: string) => void) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const trackingId = response?.notification.request.content.data?.trackingId;
    if (typeof trackingId === 'string') open(trackingId);
  }, [response, open]);
}
