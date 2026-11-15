import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { checkServer, type ServerStatus } from '@/backend/health';
import { PressableScale } from '@/components/pressable-scale';
import { SettingsGroup, SettingsRow } from '@/components/settings-row';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Toggle } from '@/components/toggle';
import { PRIVACY_URL } from '@/constants/links';
import { MaxContentWidth, Palettes, PALETTES, Radius, Spacing } from '@/constants/theme';
import { setExamplesShown, useExamplesShown } from '@/data/examples-setting';
import { setPalette, usePalette } from '@/data/palette-setting';
import { useMyProfile } from '@/data/profile-store';
import { useShareAlerts } from '@/data/share-alerts-store';
import { setThemeMode, THEME_MODES, useThemeMode } from '@/data/theme-setting';
import { displayName } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/utils/initials';
import { LANGUAGE_SETTINGS, type Messages, setLanguageSetting, useLanguageSetting, useT } from '@/i18n';
import {
  cancelAllNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  TEST_DELAY_SECONDS,
  type NotificationPermission,
} from '@/notifications/notifications';
import {
  setRemindersEnabled,
  setShareAlertsEnabled,
  useRemindersEnabled,
  useShareAlertsEnabled,
} from '@/notifications/settings';

/**
 * Onglet Réglages (refonte) : la carte du profil, puis l'apparence, la langue,
 * les notifications, la liste des process et « À propos ». Les explications
 * s'ouvrent par les boutons « ? » au lieu de phrases sous chaque réglage.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const t = useT();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <ThemedText type="title" accessibilityRole="header" style={styles.title}>
        {t.settings.title}
      </ThemedText>
      <ProfileCard />
      <AppearanceGroup />
      <LanguageGroup />
      <NotificationsGroup />
      <SettingsGroup title={t.profil.processList}>
        <ExamplesRow />
      </SettingsGroup>
      <AboutGroup />
    </ScrollView>
  );
}

/** La carte du profil, en tête : ouvre la page Profil (compte, synchronisation, données). */
function ProfileCard() {
  const theme = useTheme();
  const t = useT();
  const session = useSession();
  const state = useMyProfile();
  const profile = state.status === 'ready' ? state.profile : null;
  const name = profile ? displayName(profile) : (session?.user.email ?? '');
  const signedIn = !!session;
  const title = signedIn ? name : t.settings.signInTitle;
  const subtitle = signedIn ? t.settings.profileSubtitle : t.settings.signInSubtitle;

  return (
    <PressableScale
      onPress={() => router.push('/profil')}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityHint={t.settings.openProfile}
      style={[styles.profileCard, { backgroundColor: theme.surface }]}>
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        {signedIn ? (
          <ThemedText style={[styles.avatarText, { color: theme.onPrimary }]} maxFontSizeMultiplier={1.2}>
            {initials(name)}
          </ThemedText>
        ) : (
          <SymbolView name={{ ios: 'person.fill', android: 'person' }} size={26} tintColor={theme.onPrimary} />
        )}
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.profileName} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} tintColor={theme.textSecondary} />
    </PressableScale>
  );
}

/** Trois choix côte à côte (boutons radio) : le choisi est en relief, couleur de surface. */
function Segmented<T extends string>({
  options,
  current,
  label,
  nameOf,
  onChange,
}: {
  options: readonly T[];
  current: T;
  label: string;
  nameOf: (option: T) => string;
  onChange: (option: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.segments, { backgroundColor: theme.surfaceMuted }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option === current;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={nameOf(option)}
            style={[styles.segment, selected && { backgroundColor: theme.surface }]}>
            <ThemedText
              type="smallBold"
              style={{ fontWeight: 800, color: selected ? theme.text : theme.textSecondary }}>
              {nameOf(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Apparence : la palette (Océan, Aurore, Menthe, Corail), puis automatique, clair ou sombre. */
function AppearanceGroup() {
  const theme = useTheme();
  const t = useT();
  const mode = useThemeMode();
  const palette = usePalette();
  return (
    <SettingsGroup title={t.theme.heading} help={t.theme.helpText}>
      <View style={styles.padded}>
        <View style={styles.palettes} accessibilityRole="radiogroup" accessibilityLabel={t.theme.colors}>
          {PALETTES.map((id) => {
            const selected = id === palette;
            const swatch = Palettes[id].light;
            return (
              <Pressable
                key={id}
                onPress={() => setPalette(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t.theme.paletteLabel(t.theme.palettes[id])}
                style={styles.paletteOption}>
                <View style={[styles.paletteRing, { borderColor: selected ? theme.text : 'transparent' }]}>
                  <View style={[styles.paletteSwatch, { backgroundColor: swatch.primary }]}>
                    <View style={[styles.paletteAccent, { backgroundColor: swatch.accent }]} />
                  </View>
                </View>
                <ThemedText type="small" style={{ fontWeight: selected ? 800 : 600 }}>
                  {t.theme.palettes[id]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <Segmented
          options={THEME_MODES}
          current={mode}
          label={t.settings.mode}
          nameOf={(option) => t.theme.options[option]}
          onChange={setThemeMode}
        />
      </View>
    </SettingsGroup>
  );
}

/** Langue : automatique (comme le téléphone), français ou anglais. */
function LanguageGroup() {
  const t = useT();
  const current = useLanguageSetting();
  return (
    <SettingsGroup title={t.language.heading} help={t.settings.languageHelp}>
      <View style={styles.padded}>
        <Segmented
          options={LANGUAGE_SETTINGS}
          current={current}
          label={t.language.heading}
          nameOf={(option) => t.language.options[option]}
          onChange={setLanguageSetting}
        />
      </View>
    </SettingsGroup>
  );
}

function notificationText(
  t: Messages['profil'],
  enabled: boolean,
  permission: NotificationPermission | null,
  sent: boolean,
): string {
  if (permission === 'unavailable') return t.notifUnavailable;
  if (!enabled) return t.notifOff;
  if (permission === 'denied') return t.notifDenied;
  if (permission === 'undetermined') return t.notifUndetermined;
  if (sent) return t.notifSent(TEST_DELAY_SECONDS);
  return t.notifReady;
}

/** Rappels d'échéance, alertes du partage, liste des alertes et notification d'essai. */
function NotificationsGroup() {
  const theme = useTheme();
  const t = useT();
  const enabled = useRemindersEnabled();
  const alertsEnabled = useShareAlertsEnabled();
  const { unread } = useShareAlerts();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [sent, setSent] = useState(false);

  // L'autorisation peut changer dans les réglages du téléphone : on la relit au retour dans l'app.
  useEffect(() => {
    const refresh = () => getNotificationPermission().then(setPermission);
    refresh();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, []);

  const toggleReminders = async (next: boolean) => {
    setRemindersEnabled(next);
    setSent(false);
    if (!next) return cancelAllNotifications();
    if (permission === 'undetermined') setPermission(await requestNotificationPermission());
  };

  const toggleAlerts = async (next: boolean) => {
    setShareAlertsEnabled(next);
    if (next && permission === 'undetermined') setPermission(await requestNotificationPermission());
  };

  const test = async () => {
    await sendTestNotification();
    setSent(true);
  };

  const unavailable = permission === 'unavailable';
  const locked = unavailable || permission === null;
  const active = enabled && permission === 'granted';
  return (
    <SettingsGroup
      title={t.profil.notifications}
      footer={
        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {notificationText(t.profil, enabled, permission, sent)}
          </ThemedText>
          {enabled && permission === 'denied' && (
            <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button" hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                {t.profil.openSettings}
              </ThemedText>
            </Pressable>
          )}
        </View>
      }>
      <SettingsRow
        first
        icon={{ ios: 'clock', android: 'schedule' }}
        label={t.profil.reminders}
        help={t.profil.remindersHint}
        right={
          <Toggle
            value={enabled && !unavailable}
            onValueChange={toggleReminders}
            disabled={locked}
            accessibilityLabel={t.profil.reminders}
          />
        }
      />
      <SettingsRow
        icon={{ ios: 'person.2', android: 'group' }}
        label={t.profil.shareAlerts}
        help={t.profil.shareAlertsHint}
        right={
          <Toggle
            value={alertsEnabled && !unavailable}
            onValueChange={toggleAlerts}
            disabled={locked}
            accessibilityLabel={t.profil.shareAlerts}
          />
        }
      />
      <SettingsRow
        icon={{ ios: 'bell', android: 'notifications' }}
        label={t.settings.seeAlerts}
        onPress={() => router.push('/alertes')}
        right={
          unread > 0 ? (
            <ThemedText type="smallBold" style={{ color: theme.link }}>
              {t.settings.newAlerts(unread)}
            </ThemedText>
          ) : undefined
        }
      />
      {active && (
        <SettingsRow
          icon={{ ios: 'paperplane', android: 'send' }}
          label={t.settings.testNotification}
          onPress={test}
          right={
            <ThemedText type="smallBold" style={{ color: theme.link }}>
              {t.settings.send}
            </ThemedText>
          }
        />
      )}
    </SettingsGroup>
  );
}

/** Afficher ou masquer les process d'exemple dans la liste. */
function ExamplesRow() {
  const t = useT();
  const shown = useExamplesShown();
  return (
    <SettingsRow
      first
      icon={{ ios: 'square.stack.3d.up', android: 'account_tree' }}
      label={t.profil.showExamples}
      help={t.profil.showExamplesHint}
      right={<Toggle value={shown} onValueChange={setExamplesShown} accessibilityLabel={t.profil.showExamples} />}
    />
  );
}

/** Le serveur Supabase répond-il ? Vérifié à l'ouverture de l'écran, et en touchant la ligne s'il ne répond pas. */
function ServerRow() {
  const theme = useTheme();
  const t = useT();
  const [status, setStatus] = useState<ServerStatus | 'checking'>('checking');

  const check = useCallback(async () => {
    setStatus('checking');
    setStatus(await checkServer());
  }, []);

  useEffect(() => {
    let active = true;
    checkServer().then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const failed = status !== 'checking' && status !== 'ok';
  const color = status === 'ok' ? theme.success : status === 'checking' ? theme.textSecondary : theme.danger;
  const label = (
    <>
      {status === 'checking' ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <ThemedText type="smallBold" style={{ color }}>
        {t.settings.serverStatus[status]}
      </ThemedText>
      {failed && <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh' }} size={16} tintColor={color} />}
    </>
  );
  return (
    <SettingsRow
      icon={{ ios: 'server.rack', android: 'dns' }}
      label={t.settings.server}
      help={t.settings.serverHelp}
      right={
        failed ? (
          <Pressable
            onPress={check}
            accessibilityRole="button"
            accessibilityLabel={`${t.settings.serverStatus[status]}, ${t.common.retry}`}
            hitSlop={8}
            style={styles.status}>
            {label}
          </Pressable>
        ) : (
          <View style={styles.status} accessible accessibilityLiveRegion="polite">
            {label}
          </View>
        )
      }
    />
  );
}

/**
 * À propos : revoir la présentation, la politique de confidentialité, la version
 * (avec la date de la mise à jour à distance EAS Update en cours, s'il y en a une)
 * et l'état du serveur.
 */
function AboutGroup() {
  const theme = useTheme();
  const t = useT();
  const locale = t.common.locale;
  const version = Constants.expoConfig?.version ?? '';
  const update =
    !Updates.isEmbeddedLaunch && Updates.createdAt
      ? t.profil.updateOf(
          Updates.createdAt.toLocaleDateString(locale),
          Updates.createdAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        )
      : t.profil.installedVersion;
  return (
    <SettingsGroup title={t.profil.about}>
      <SettingsRow
        first
        icon={{ ios: 'play.rectangle', android: 'slideshow' }}
        label={t.settings.replayWelcome}
        onPress={() => router.push('/bienvenue')}
      />
      <SettingsRow
        icon={{ ios: 'checkmark.shield', android: 'verified_user' }}
        label={t.settings.privacy}
        accessibilityRole="link"
        accessibilityHint={t.profil.opensInBrowser}
        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        right={
          <SymbolView
            name={{ ios: 'arrow.up.right', android: 'open_in_new' }}
            size={16}
            tintColor={theme.textSecondary}
          />
        }
      />
      <SettingsRow
        icon={{ ios: 'info.circle', android: 'info' }}
        label={t.settings.version}
        help={`${t.settings.versionHelp}\n\nSimuFlow ${version} · ${update}`}
        right={
          <ThemedText type="smallBold" themeColor="textSecondary">
            {version}
          </ThemedText>
        }
      />
      <ServerRow />
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: {
    fontWeight: 800,
  },
  flex: { flex: 1 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radius.large,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: 800,
  },
  profileName: {
    fontSize: 17,
    fontWeight: 800,
  },
  padded: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  palettes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  paletteOption: {
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 64,
  },
  paletteRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    padding: 3,
  },
  paletteSwatch: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  paletteAccent: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '50%',
    height: '50%',
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: Radius.small + Spacing.one,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small - 2,
  },
  footer: {
    gap: Spacing.one,
    marginHorizontal: Spacing.one,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
