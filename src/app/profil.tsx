import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { deleteAccount, signOut, useSession } from '@/backend/auth';
import { PressableScale } from '@/components/pressable-scale';
import { PrimaryButton } from '@/components/primary-button';
import { SettingsGroup } from '@/components/settings-row';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { syncNow, useSyncStatus, type SyncStatus } from '@/data/cloud-sync';
import { removeSavedForm, showSavedForm, useSavedForms } from '@/data/form-store';
import { DEMO_SCENARIOS, setDemoScenario, useDemoScenario, useImportedProcesses } from '@/data/process-store';
import { useMyProfile } from '@/data/profile-store';
import { forgetReadingRule, useReadingRules } from '@/data/rules-store';
import { useSharedProcesses } from '@/data/shared-store';
import { displayName } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { describeRule } from '@/import';
import { type Messages, useT } from '@/i18n';
import { initials } from '@/utils/initials';

/**
 * La page Profil (refonte R4), ouverte par la carte en tête des Réglages :
 * une bannière aux couleurs de la palette (avatar, nom, identifiant et rôle),
 * les chiffres, la synchronisation, mes formulaires, les règles apprises,
 * la déconnexion et, replié, la suppression du compte.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const session = useSession();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ headerShown: false }} />
      <Banner />
      <View style={styles.content}>
        <Stats />
        {session ? <SyncCard /> : <SignInCard />}
        <SavedForms />
        <ReadingRules />
        {session && <SignOut />}
        {session && <DeleteAccount />}
        {__DEV__ && <DemoScenarioPicker />}
      </View>
    </ScrollView>
  );
}

/** La bannière : le chemin en S en filigrane, Revenir, Modifier, puis l'avatar et le nom. */
function Banner() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const session = useSession();
  const state = useMyProfile();
  const profile = state.status === 'ready' ? state.profile : null;

  let name: string;
  let detail: string;
  if (!session) {
    name = t.profil.noAccount;
    detail = t.profil.noAccountDetail;
  } else if (profile) {
    name = displayName(profile);
    detail = [`@${profile.username}`, profile.role ? t.roles[profile.role] : null].filter(Boolean).join(' · ');
  } else {
    name = session.user.email ?? '';
    if (state.status === 'error') detail = state.message;
    else if (state.status === 'ready') detail = t.profil.profileMissing;
    else detail = t.profil.profileLoading;
  }
  const onBanner = theme.onPrimary;

  return (
    <View style={[styles.banner, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.three }]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 268" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Path
          d="M-20 70 H260 A60 60 0 0 1 260 190 H120 A60 60 0 0 0 120 310"
          fill="none"
          stroke={onBanner}
          strokeOpacity={0.16}
          strokeWidth={22}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.bannerBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/reglages'))}
          accessibilityRole="button"
          accessibilityLabel={t.profil.back}
          style={({ pressed }) => [styles.roundButton, { opacity: pressed ? 0.7 : 1 }]}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back' }} size={20} tintColor={onBanner} />
        </Pressable>
        {session && (
          <Pressable
            onPress={() => router.push('/mon-profil')}
            accessibilityRole="button"
            accessibilityLabel={t.profil.editLabel}
            style={({ pressed }) => [styles.pillButton, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={[styles.strong, { color: onBanner }]}>
              {t.profil.edit}
            </ThemedText>
          </Pressable>
        )}
      </View>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(400)}
        style={styles.identity}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${name}, ${detail}`}>
        <View style={[styles.avatar, { backgroundColor: onBanner }]}>
          {session ? (
            <ThemedText style={[styles.avatarText, { color: theme.primary }]} maxFontSizeMultiplier={1.2}>
              {initials(name)}
            </ThemedText>
          ) : (
            <SymbolView name={{ ios: 'person.fill', android: 'person' }} size={34} tintColor={theme.primary} />
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText style={[styles.name, { color: onBanner }]} numberOfLines={2}>
            {name}
          </ThemedText>
          <ThemedText type="small" style={{ color: onBanner, opacity: 0.92 }} numberOfLines={2}>
            {detail}
          </ThemedText>
        </View>
      </Animated.View>
    </View>
  );
}

/** Trois chiffres : mes process, ceux partagés avec moi, mes formulaires gardés. */
function Stats() {
  const theme = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const processes = useImportedProcesses().length;
  const shared = useSharedProcesses().length;
  const forms = useSavedForms().length;
  const items = [
    { value: processes, label: t.profil.stats.processes },
    { value: shared, label: t.profil.stats.shared },
    { value: forms, label: t.profil.stats.forms },
  ];
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.delay(100).duration(400)}
      style={[styles.stats, { backgroundColor: theme.surface }]}
      accessible
      accessibilityLabel={t.profil.statsLabel(processes, shared, forms)}>
      {items.map((item) => (
        <View key={item.label} style={styles.stat}>
          <ThemedText style={styles.statValue}>{item.value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.semi}>
            {item.label}
          </ThemedText>
        </View>
      ))}
    </Animated.View>
  );
}

function syncText(t: Messages, status: SyncStatus): string {
  switch (status.state) {
    case 'syncing':
      return t.profil.syncing;
    case 'done':
      return t.profil.syncedAt(status.at.toLocaleTimeString(t.common.locale, { hour: '2-digit', minute: '2-digit' }));
    case 'error':
      return status.message;
    default:
      return t.profil.syncIdle;
  }
}

/** La synchronisation : son état, et le bouton rond pour la relancer. */
function SyncCard() {
  const theme = useTheme();
  const t = useT();
  const status = useSyncStatus();
  const syncing = status.state === 'syncing';
  const failed = status.state === 'error';
  const tone = failed
    ? { text: theme.warning, background: theme.warningBackground }
    : { text: theme.success, background: theme.successBackground };
  return (
    <View style={[styles.card, styles.row, { backgroundColor: theme.surface }]}>
      <View style={[styles.iconTile, { backgroundColor: tone.background }]}>
        <SymbolView
          name={
            failed
              ? { ios: 'exclamationmark.icloud', android: 'cloud_off' }
              : { ios: 'checkmark.icloud', android: 'cloud_done' }
          }
          size={18}
          tintColor={tone.text}
        />
      </View>
      <View style={styles.flex}>
        <ThemedText
          style={[styles.strong, failed && { color: theme.warning }]}
          accessibilityLiveRegion="polite"
          numberOfLines={3}>
          {syncText(t, status)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t.profil.syncWhat}
        </ThemedText>
      </View>
      <PressableScale
        onPress={syncNow}
        disabled={syncing}
        accessibilityRole="button"
        accessibilityLabel={t.profil.syncLabel}
        accessibilityState={{ disabled: syncing, busy: syncing }}
        style={[styles.roundAction, { backgroundColor: theme.primaryBackground }]}>
        {syncing ? (
          <ActivityIndicator color={theme.link} />
        ) : (
          <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync' }} size={19} tintColor={theme.link} />
        )}
      </PressableScale>
    </View>
  );
}

/** Sans compte : l'invitation à se connecter, à la place de la synchronisation. */
function SignInCard() {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={[styles.card, styles.signIn, { backgroundColor: theme.surface }]}>
      <ThemedText themeColor="textSecondary">{t.profil.signInInvite}</ThemedText>
      <PrimaryButton label={t.common.signIn} onPress={() => router.push('/connexion')} />
    </View>
  );
}

/** Une ligne de liste : titre, détail, et un petit bouton à droite (Retirer, Oublier). */
function ItemRow({
  first,
  title,
  detail,
  onOpen,
  openLabel,
  action,
  actionLabel,
  onAction,
}: {
  first: boolean;
  title: string;
  detail?: string;
  onOpen?: () => void;
  openLabel?: string;
  action: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useTheme();
  const text = (
    <>
      <ThemedText style={[styles.strong, onOpen && { color: theme.link }]}>{title}</ThemedText>
      {detail && (
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      )}
    </>
  );
  return (
    <View
      style={[styles.itemRow, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      {onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={openLabel} style={styles.flex}>
          {text}
        </Pressable>
      ) : (
        <View style={styles.flex}>{text}</View>
      )}
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={6}
        style={({ pressed }) => [styles.chip, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold">{action}</ThemedText>
      </Pressable>
    </View>
  );
}

/** Les formulaires gardés, à rouvrir (remplir, lier un workflow) ou à retirer. */
function SavedForms() {
  const t = useT();
  const session = useSession();
  const forms = useSavedForms();
  const open = (index: number) => {
    showSavedForm(forms[index]);
    router.push('/formulaire');
  };
  return (
    <SettingsGroup
      title={t.profil.savedForms}
      help={`${t.profil.formsHelp}\n\n${session ? t.profil.formsKeptAccount : t.profil.formsKeptLocal}`}>
      {forms.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {t.profil.noForms}
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
            <ItemRow
              key={saved.id}
              first={index === 0}
              title={name}
              detail={t.profil.formQuestions(saved.form.questions.length, link)}
              onOpen={() => open(index)}
              openLabel={t.profil.openForm(name, link)}
              action={t.common.remove}
              actionLabel={t.profil.removeForm(name)}
              onAction={() => removeSavedForm(saved.id)}
            />
          );
        })
      )}
    </SettingsGroup>
  );
}

/** Les règles de lecture apprises des corrections, chacune avec « Oublier ». */
function ReadingRules() {
  const t = useT();
  const rules = useReadingRules();
  const session = useSession();
  return (
    <SettingsGroup
      title={t.profil.rules}
      help={`${t.profil.rulesHelp}\n\n${session ? t.profil.rulesKeptAccount : t.profil.rulesKeptLocal}`}>
      {rules.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {t.profil.noRules}
        </ThemedText>
      ) : (
        rules.map((rule, index) => {
          const text = describeRule(rule, t);
          return (
            <ItemRow
              key={text}
              first={index === 0}
              title={text}
              action={t.profil.forget}
              actionLabel={t.profil.forgetRule(text)}
              onAction={() => forgetReadingRule(rule)}
            />
          );
        })
      )}
    </SettingsGroup>
  );
}

/** Se déconnecter : les process restent sur le compte. */
function SignOut() {
  const theme = useTheme();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async () => {
    setBusy(true);
    const result = await signOut();
    setBusy(false);
    setError(result.ok ? null : result.message);
  };
  return (
    <View style={styles.signOutBlock}>
      <PressableScale
        onPress={leave}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t.profil.signOut}
        style={[styles.signOut, { backgroundColor: theme.surface }]}>
        {busy ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <>
            <SymbolView
              name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout' }}
              size={18}
              tintColor={theme.text}
            />
            <ThemedText style={styles.strong}>{t.profil.signOut}</ThemedText>
          </>
        )}
      </PressableScale>
      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * Supprimer son compte, replié : le premier toucher déplie ce qui sera effacé
 * (première demande) ; seul « Supprimer définitivement » supprime (seconde).
 */
function DeleteAccount() {
  const theme = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    const result = await deleteAccount();
    // Réussi : la session disparaît et le Profil repasse à « Sans compte ».
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <View style={[styles.danger, { borderColor: theme.danger }]}>
      <Pressable
        onPress={() => {
          setOpen(!open);
          setError(null);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.dangerHeader}>
        <ThemedText style={[styles.strong, styles.flex, { color: theme.danger }]}>{t.profil.deleteAccount}</ThemedText>
        <SymbolView
          name={open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }}
          size={18}
          tintColor={theme.danger}
        />
      </Pressable>
      {open && (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(250)} style={styles.dangerBody}>
          <ThemedText type="smallBold" style={{ color: theme.danger }} accessibilityRole="header">
            {t.profil.deleteConfirmTitle}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.profil.deleteConfirmText}
          </ThemedText>
          {error && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {error}
            </ThemedText>
          )}
          <Pressable
            onPress={confirm}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t.profil.deleteConfirmLabel}
            style={({ pressed }) => [
              styles.dangerButton,
              { backgroundColor: theme.danger, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.strong, { color: theme.background }]}>{t.profil.deleteForever}</ThemedText>
            )}
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

/** Mode développement : force un état de la liste des process, pour le montrer. */
function DemoScenarioPicker() {
  const theme = useTheme();
  const t = useT();
  const current = useDemoScenario();
  return (
    <SettingsGroup title={t.profil.demo}>
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
                { backgroundColor: selected ? theme.primary : theme.surfaceMuted, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {t.errors.demo[option.value]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.six,
  },
  content: {
    gap: Spacing.three + Spacing.one,
    paddingHorizontal: Spacing.four - Spacing.one,
    marginTop: -Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  flex: { flex: 1 },
  strong: { fontWeight: 800 },
  semi: { fontWeight: 600 },
  banner: {
    minHeight: 268,
    paddingHorizontal: Spacing.four - Spacing.one,
    paddingBottom: Spacing.five + Spacing.four,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: Spacing.four,
  },
  bannerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButton: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
  },
  avatarText: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 800,
  },
  name: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  stats: {
    flexDirection: 'row',
    borderRadius: Radius.large,
    paddingVertical: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.one,
    boxShadow: '0 10px 30px rgba(14, 27, 44, 0.10)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
  },
  card: {
    borderRadius: Radius.large,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingVertical: Spacing.three - Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three - Spacing.one,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signIn: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  itemRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three - Spacing.one,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: Spacing.three,
  },
  signOutBlock: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  signOut: {
    minHeight: 52,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  danger: {
    borderRadius: Radius.large - 2,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  dangerHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  dangerBody: {
    gap: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: Radius.small + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
});
