import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { signOut, useSession } from '@/backend/auth';
import { checkServer, type ServerStatus } from '@/backend/health';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { DEMO_SCENARIOS, setDemoScenario, useDemoScenario } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  return (
    <PlaceholderScreen title="Profil" description="Votre compte, et l'état du serveur SimuFlow.">
      <Account />
      <ServerCheck />
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
  box: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  boxText: { paddingVertical: Spacing.three },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two },
  identity: { gap: Spacing.three },
  divider: { height: StyleSheet.hairlineWidth },
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
