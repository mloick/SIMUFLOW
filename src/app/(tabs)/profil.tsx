import Constants from 'expo-constants';
import { Link } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { deleteAccount, signOut, useSession } from '@/backend/auth';
import { checkServer, type ServerStatus } from '@/backend/health';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { syncNow, useSyncStatus, type SyncStatus } from '@/data/cloud-sync';
import { DEMO_SCENARIOS, setDemoScenario, useDemoScenario } from '@/data/process-store';
import { forgetReadingRule, useReadingRules } from '@/data/rules-store';
import { describeRule } from '@/import';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelAllNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  TEST_DELAY_SECONDS,
  type NotificationPermission,
} from '@/notifications/notifications';
import { setRemindersEnabled, useRemindersEnabled } from '@/notifications/settings';
import { setExamplesShown, useExamplesShown } from '@/data/examples-setting';

export default function ProfileScreen() {
  return (
    <PlaceholderScreen title="Profil" description="Votre compte, et l'état du serveur SimuFlow.">
      <Account />
      <ReadingRules />
      <NotificationSettings />
      <ExamplesSetting />
      <ServerCheck />
      <AppVersion />
      {__DEV__ && <DemoScenarioPicker />}
    </PlaceholderScreen>
  );
}

/** Le compte connecté et le bouton de déconnexion, ou l'invitation à se connecter. */
function Account() {
  const theme = useTheme();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    const result = await signOut();
    setBusy(false);
    setError(result.ok ? null : result.message);
  };

  const box = [styles.box, { backgroundColor: theme.surface, borderColor: theme.border }];
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Compte
      </ThemedText>
      {session === undefined ? (
        <View style={[box, styles.row]}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : session === null ? (
        <View style={box}>
          <ThemedText themeColor="textSecondary" style={styles.boxText}>
            Connectez-vous pour retrouver vos process sur tous vos appareils.
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Link href="/connexion" style={styles.row} accessibilityRole="link">
            <ThemedText type="link">Se connecter ou créer un compte →</ThemedText>
          </Link>
        </View>
      ) : (
        <View style={box}>
          <View
            style={[styles.row, styles.identity]}
            accessible
            accessibilityLabel={`Connecté : ${session.user.email}`}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryBackground }]}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                {initials(session.user.email)}
              </ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Connecté
              </ThemedText>
              <ThemedText numberOfLines={1}>{session.user.email}</ThemedText>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SyncRow />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable onPress={leave} disabled={busy} accessibilityRole="button" style={styles.row}>
            {busy ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <ThemedText type="link" style={{ color: theme.danger }}>
                Se déconnecter
              </ThemedText>
            )}
          </Pressable>
        </View>
      )}
      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
      {session && <DeleteAccount />}
    </View>
  );
}

/** Les règles de lecture apprises des corrections, chacune avec « Oublier ». */
function ReadingRules() {
  const theme = useTheme();
  const rules = useReadingRules();
  const session = useSession();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Règles de lecture apprises
      </ThemedText>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {rules.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.boxText}>
            Aucune pour l’instant. Quand vous corrigez un process importé (un acteur renommé partout, une forme qui veut
            dire « décision »), SimuFlow le retient et le refait aux imports suivants.
          </ThemedText>
        ) : (
          rules.map((rule, index) => {
            const text = describeRule(rule);
            return (
              <View key={text}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={[styles.row, styles.identity]}>
                  <ThemedText style={styles.flex}>{text}</ThemedText>
                  <Pressable
                    onPress={() => forgetReadingRule(rule)}
                    accessibilityRole="button"
                    accessibilityLabel={`Oublier la règle : ${text}`}
                    hitSlop={8}>
                    <ThemedText type="link" style={{ color: theme.danger }}>
                      Oublier
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {session
          ? 'Gardées sur ce téléphone et sur votre compte.'
          : 'Gardées sur ce téléphone. Connectez-vous pour les retrouver sur tous vos appareils.'}
      </ThemedText>
    </View>
  );
}

/** Réglage des rappels d'échéance, état de l'autorisation et notification d'essai. */
/** Afficher ou masquer les process d'exemple dans la liste. */
function ExamplesSetting() {
  const theme = useTheme();
  const shown = useExamplesShown();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Liste des process
      </ThemedText>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.row, styles.identity]}>
          <View style={styles.flex}>
            <ThemedText>Afficher les exemples</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Quatre process fictifs fournis avec l’app, en bas de la liste.
            </ThemedText>
          </View>
          <Switch
            value={shown}
            onValueChange={setExamplesShown}
            trackColor={{ true: theme.link }}
            accessibilityLabel="Afficher les exemples"
          />
        </View>
      </View>
    </View>
  );
}

function NotificationSettings() {
  const theme = useTheme();
  const enabled = useRemindersEnabled();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [sent, setSent] = useState(false);

  // L'autorisation peut changer dans les réglages du téléphone : on la relit au retour dans l'app.
  useEffect(() => {
    const refresh = () => getNotificationPermission().then(setPermission);
    refresh();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, []);

  const toggle = async (next: boolean) => {
    setRemindersEnabled(next);
    setSent(false);
    if (!next) return cancelAllNotifications();
    if (permission === 'undetermined') setPermission(await requestNotificationPermission());
  };

  const test = async () => {
    await sendTestNotification();
    setSent(true);
  };

  const unavailable = permission === 'unavailable';
  const active = enabled && permission === 'granted';
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Notifications
      </ThemedText>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.row, styles.identity]}>
          <View style={styles.flex}>
            <ThemedText>Rappels d’échéance</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Le matin de l’échéance de chaque étape d’une demande suivie, puis en cas de retard.
            </ThemedText>
          </View>
          <Switch
            value={enabled && !unavailable}
            onValueChange={toggle}
            disabled={unavailable || permission === null}
            trackColor={{ true: theme.link }}
            accessibilityLabel="Rappels d’échéance"
          />
        </View>
        {active && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable onPress={test} accessibilityRole="button" style={styles.row}>
              <ThemedText type="link" style={{ color: theme.link }}>
                Envoyer une notification d’essai
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {notificationText(enabled, permission, sent)}
      </ThemedText>
      {enabled && permission === 'denied' && (
        <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="link" style={{ color: theme.link }}>
            Ouvrir les réglages
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function notificationText(enabled: boolean, permission: NotificationPermission | null, sent: boolean): string {
  if (permission === 'unavailable') return 'Les notifications ne sont pas disponibles dans le navigateur.';
  if (!enabled) return 'Rappels coupés : aucune notification ne sera envoyée.';
  if (permission === 'denied') return 'Les notifications sont refusées pour SimuFlow dans les réglages du téléphone.';
  if (permission === 'undetermined') return 'Le téléphone vous demandera l’autorisation au premier rappel.';
  if (sent) return `Notification envoyée : elle arrive dans ${TEST_DELAY_SECONDS} secondes, même téléphone verrouillé.`;
  return 'Les notifications sont programmées sur ce téléphone, sans serveur.';
}

function syncText(status: SyncStatus): string {
  switch (status.state) {
    case 'syncing':
      return 'Synchronisation…';
    case 'done':
      return `Process synchronisés à ${status.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    case 'error':
      return status.message;
    default:
      return 'Vos process importés sont gardés sur votre compte.';
  }
}

/** État de la synchronisation des process importés, et bouton pour la relancer. */
function SyncRow() {
  const theme = useTheme();
  const status = useSyncStatus();
  const syncing = status.state === 'syncing';
  return (
    <View style={[styles.row, styles.identity]} accessible={false}>
      {syncing ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <View style={[styles.dot, { backgroundColor: status.state === 'error' ? theme.warning : theme.success }]} />
      )}
      <ThemedText
        type="small"
        style={[styles.flex, { color: status.state === 'error' ? theme.warning : theme.textSecondary }]}
        accessibilityLiveRegion="polite">
        {syncText(status)}
      </ThemedText>
      {!syncing && (
        <Pressable onPress={syncNow} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            Synchroniser
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Supprimer son compte : demandé deux fois. Le premier bouton ouvre un encadré
 * qui dit ce qui sera effacé ; seul le second supprime.
 */
function DeleteAccount() {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    const result = await deleteAccount();
    // Réussi : la session disparaît et le Profil repasse à « Se connecter ».
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  if (!confirming) {
    return (
      <View style={styles.deleteBlock}>
        <Pressable
          onPress={() => setConfirming(true)}
          accessibilityRole="button"
          style={[styles.box, styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="link" style={{ color: theme.danger }}>
            Supprimer mon compte
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          La suppression efface votre compte et vos process, sur le serveur et sur ce téléphone. Elle vous sera demandée
          une seconde fois pour confirmer.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[styles.confirm, { backgroundColor: theme.dangerBackground, borderColor: theme.danger }]}
      accessibilityRole="alert">
      <ThemedText type="smallBold" style={{ color: theme.danger }}>
        Supprimer définitivement votre compte ?
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.text }}>
        Votre compte et tous vos process seront effacés, sur le serveur et sur ce téléphone. Impossible de revenir en
        arrière.
      </ThemedText>
      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
      <View style={styles.confirmButtons}>
        <Pressable
          onPress={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.confirmButton, { borderColor: theme.fieldBorder, backgroundColor: theme.surface }]}>
          <ThemedText type="smallBold">Annuler</ThemedText>
        </Pressable>
        <Pressable
          onPress={confirm}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Supprimer définitivement mon compte"
          style={[styles.confirmButton, { borderColor: theme.danger, backgroundColor: theme.danger }]}>
          {busy ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Supprimer
            </ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/** « camille.martin@exemple.fr » → « CM ». */
function initials(email = '') {
  const parts = email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : email.slice(0, 2)).toUpperCase();
}

const STATUS_TEXT: Record<ServerStatus | 'checking', string> = {
  checking: 'Vérification du serveur…',
  ok: 'Serveur SimuFlow joignable',
  unreachable: 'Serveur injoignable : vérifiez la connexion Internet',
  error: 'Le serveur répond avec une erreur',
};

/** Le serveur Supabase répond-il ? Vérifié à l'ouverture de l'écran, et à la demande. */
function ServerCheck() {
  const theme = useTheme();
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

  const color = status === 'ok' ? theme.success : status === 'checking' ? theme.textSecondary : theme.danger;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Serveur
      </ThemedText>
      <View
        style={[styles.server, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={STATUS_TEXT[status]}>
        {status === 'checking' ? (
          <ActivityIndicator color={theme.textSecondary} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
        <ThemedText style={[styles.flex, { color: status === 'checking' ? theme.textSecondary : theme.text }]}>
          {STATUS_TEXT[status]}
        </ThemedText>
        {status !== 'checking' && status !== 'ok' && (
          <Pressable onPress={check} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.link }}>
              Réessayer
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Version de l'app, et date de la mise à jour à distance (EAS Update) en
 * cours d'utilisation, s'il y en a une.
 */
function AppVersion() {
  const version = Constants.expoConfig?.version ?? '';
  const update =
    !Updates.isEmbeddedLaunch && Updates.createdAt
      ? `mise à jour du ${Updates.createdAt.toLocaleDateString('fr-FR')} à ${Updates.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : 'version installée';
  return (
    <View style={styles.version}>
      <Link href="/bienvenue" accessibilityRole="button" style={styles.replay}>
        <ThemedText type="link">Revoir la présentation</ThemedText>
      </Link>
      <ThemedText type="small" themeColor="textSecondary">
        SimuFlow {version} · {update}
      </ThemedText>
    </View>
  );
}

/** Mode développement : force un état de la liste des process, pour le montrer. */
function DemoScenarioPicker() {
  const theme = useTheme();
  const current = useDemoScenario();

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Démo · état de la liste des process
      </ThemedText>
      <View style={styles.options} accessibilityRole="radiogroup">
        {DEMO_SCENARIOS.map((option) => {
          const selected = option.value === current;
          return (
            <Pressable
              key={option.value}
              onPress={() => setDemoScenario(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.option,
                { backgroundColor: selected ? theme.primary : theme.surface, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  flex: { flex: 1 },
  version: { alignItems: 'center', gap: Spacing.two },
  replay: { minHeight: 44, paddingVertical: Spacing.two },
  box: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  boxText: { paddingVertical: Spacing.three },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two },
  identity: { gap: Spacing.three },
  divider: { height: StyleSheet.hairlineWidth },
  deleteBlock: { gap: Spacing.two, marginTop: Spacing.two },
  confirm: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  confirmButtons: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  server: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
});
