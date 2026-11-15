import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { deleteAccount, signOut, useSession } from '@/backend/auth';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { syncNow, useSyncStatus, type SyncStatus } from '@/data/cloud-sync';
import { DEMO_SCENARIOS, setDemoScenario, useDemoScenario } from '@/data/process-store';
import { forgetReadingRule, useReadingRules } from '@/data/rules-store';
import { removeSavedForm, showSavedForm, useSavedForms } from '@/data/form-store';
import { describeRule } from '@/import';
import { useTheme } from '@/hooks/use-theme';
import { useMyProfile } from '@/data/profile-store';
import { displayName } from '@/domain';
import { type Messages, useT } from '@/i18n';

/**
 * La page Profil, ouverte depuis la carte en tête des Réglages : le compte et
 * sa synchronisation, les formulaires gardés et les règles de lecture apprises.
 * (Elle sera redessinée à l'étape R4 de la refonte.)
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const t = useT();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <ThemedText themeColor="textSecondary">{t.profil.intro}</ThemedText>
      <Account />
      <SavedForms />
      <ReadingRules />
      {__DEV__ && <DemoScenarioPicker />}
    </ScrollView>
  );
}

/** Le compte connecté et le bouton de déconnexion, ou l'invitation à se connecter. */
function Account() {
  const theme = useTheme();
  const t = useT();
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
        {t.profil.account}
      </ThemedText>
      {session === undefined ? (
        <View style={[box, styles.row]}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : session === null ? (
        <View style={box}>
          <ThemedText themeColor="textSecondary" style={styles.boxText}>
            {t.profil.signInInvite}
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Link href="/connexion" style={styles.row} accessibilityRole="link">
            <ThemedText type="link">{t.profil.signInLink}</ThemedText>
          </Link>
        </View>
      ) : (
        <View style={box}>
          <View
            style={[styles.row, styles.identity]}
            accessible
            accessibilityLabel={t.profil.connectedAs(session.user.email ?? '')}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryBackground }]}>
              <ThemedText type="smallBold" style={{ color: theme.link }} maxFontSizeMultiplier={1.4}>
                {initials(session.user.email)}
              </ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                {t.profil.connected}
              </ThemedText>
              <ThemedText numberOfLines={1}>{session.user.email}</ThemedText>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <ProfileRow />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SyncRow />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable onPress={leave} disabled={busy} accessibilityRole="button" style={styles.row}>
            {busy ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <ThemedText type="link" style={{ color: theme.danger }}>
                {t.profil.signOut}
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

/** Les formulaires gardés, à rouvrir (remplir, lier un workflow) ou à retirer. */
function SavedForms() {
  const theme = useTheme();
  const t = useT();
  const session = useSession();
  const forms = useSavedForms();
  const open = (index: number) => {
    showSavedForm(forms[index]);
    router.push('/formulaire');
  };
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {t.profil.savedForms}
      </ThemedText>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {forms.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.boxText}>
            {t.profil.savedFormsEmpty}
          </ThemedText>
        ) : (
          forms.map((saved, index) => {
            const name = saved.form.name ?? t.profil.unnamedForm;
            const link = saved.workflow
              ? t.profil.linkedTo(
                  saved.workflow.source ||
                    (saved.workflow.kind === 'process' ? saved.workflow.process.name : t.profil.aWorkflow),
                )
              : t.profil.noWorkflow;
            return (
              <View key={saved.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={[styles.row, styles.identity]}>
                  <Pressable
                    onPress={() => open(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t.profil.openForm(name, link)}
                    style={styles.flex}>
                    <ThemedText style={{ color: theme.link }}>{name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t.profil.formQuestions(saved.form.questions.length, link)}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => removeSavedForm(saved.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t.profil.removeForm(name)}
                    hitSlop={8}>
                    <ThemedText type="link" style={{ color: theme.danger }}>
                      {t.common.remove}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {session ? t.profil.formsKeptAccount : t.profil.formsKeptLocal}
      </ThemedText>
    </View>
  );
}

/** Les règles de lecture apprises des corrections, chacune avec « Oublier ». */
function ReadingRules() {
  const theme = useTheme();
  const t = useT();
  const rules = useReadingRules();
  const session = useSession();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {t.profil.rules}
      </ThemedText>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {rules.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.boxText}>
            {t.profil.rulesEmpty}
          </ThemedText>
        ) : (
          rules.map((rule, index) => {
            const text = describeRule(rule, t);
            return (
              <View key={text}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={[styles.row, styles.identity]}>
                  <ThemedText style={styles.flex}>{text}</ThemedText>
                  <Pressable
                    onPress={() => forgetReadingRule(rule)}
                    accessibilityRole="button"
                    accessibilityLabel={t.profil.forgetRule(text)}
                    hitSlop={8}>
                    <ThemedText type="link" style={{ color: theme.danger }}>
                      {t.profil.forget}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {session ? t.profil.rulesKeptAccount : t.profil.rulesKeptLocal}
      </ThemedText>
    </View>
  );
}

/** Nom, identifiant et rôle du compte, avec le lien vers « Mon profil ». */
function ProfileRow() {
  const theme = useTheme();
  const t = useT();
  const state = useMyProfile();
  const profile = state.status === 'ready' ? state.profile : null;
  let detail: string;
  if (state.status === 'loading' || state.status === 'none') detail = t.profil.profileLoading;
  else if (state.status === 'error') detail = state.message;
  else if (!profile) detail = t.profil.profileMissing;
  else detail = [`@${profile.username}`, profile.role ? t.roles[profile.role] : null].filter(Boolean).join(' · ');
  return (
    <Link href="/mon-profil" accessibilityRole="button" style={styles.row}>
      <View style={[styles.flex, styles.profileText]}>
        <ThemedText>{profile ? displayName(profile) : t.profil.completeProfile}</ThemedText>
        <ThemedText
          type="small"
          style={{
            color: state.status === 'error' ? theme.danger : theme.textSecondary,
          }}
          numberOfLines={2}>
          {detail}
        </ThemedText>
      </View>
      <ThemedText type="link"> {profile ? t.profil.editProfile : '→'}</ThemedText>
    </Link>
  );
}

function syncText(t: Messages, status: SyncStatus): string {
  switch (status.state) {
    case 'syncing':
      return t.profil.syncing;
    case 'done':
      return t.profil.syncedAt(
        status.at.toLocaleTimeString(t.common.locale, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    case 'error':
      return status.message;
    default:
      return t.profil.syncIdle;
  }
}

/** État de la synchronisation des process importés, et bouton pour la relancer. */
function SyncRow() {
  const theme = useTheme();
  const t = useT();
  const status = useSyncStatus();
  const syncing = status.state === 'syncing';
  return (
    <View style={[styles.row, styles.identity]} accessible={false}>
      {syncing ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: status.state === 'error' ? theme.warning : theme.success,
            },
          ]}
        />
      )}
      <ThemedText
        type="small"
        style={[
          styles.flex,
          {
            color: status.state === 'error' ? theme.warning : theme.textSecondary,
          },
        ]}
        accessibilityLiveRegion="polite">
        {syncText(t, status)}
      </ThemedText>
      {!syncing && (
        <Pressable onPress={syncNow} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {t.profil.syncNow}
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
  const t = useT();
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
            {t.profil.deleteAccount}
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {t.profil.deleteAccountHint}
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[styles.confirm, { backgroundColor: theme.dangerBackground, borderColor: theme.danger }]}
      accessibilityRole="alert">
      <ThemedText type="smallBold" style={{ color: theme.danger }}>
        {t.profil.deleteConfirmTitle}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.text }}>
        {t.profil.deleteConfirmText}
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
          <ThemedText type="smallBold">{t.common.cancel}</ThemedText>
        </Pressable>
        <Pressable
          onPress={confirm}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.profil.deleteConfirmLabel}
          style={[styles.confirmButton, { borderColor: theme.danger, backgroundColor: theme.danger }]}>
          {busy ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t.profil.deleteConfirm}
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

/** Mode développement : force un état de la liste des process, pour le montrer. */
function DemoScenarioPicker() {
  const theme = useTheme();
  const t = useT();
  const current = useDemoScenario();

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {t.profil.demo}
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
                {
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {t.errors.demo[option.value]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
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
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  identity: { gap: Spacing.three },
  profileText: { gap: Spacing.half },
  divider: { height: StyleSheet.hairlineWidth },
  deleteBlock: { gap: Spacing.two, marginTop: Spacing.two },
  confirm: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  palettes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
  },
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
