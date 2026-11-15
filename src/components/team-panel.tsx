import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useSession } from '@/backend/auth';
import {
  inviteToProject,
  listTeam,
  personName,
  removeFromTeam,
  transferChef,
  type TeamMember,
  type TeamRole,
} from '@/backend/project-team';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Badge } from '@/components/badge';
import { HelpButton } from '@/components/help-button';
import { PrimaryButton } from '@/components/primary-button';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { syncNow } from '@/data/cloud-sync';
import { isProjectSynced, useProjects } from '@/data/project-store';
import { useTheme } from '@/hooks/use-theme';
import { getT, useT } from '@/i18n';
import { confirmAction } from '@/utils/confirm';
import { initials } from '@/utils/initials';

/**
 * L'équipe d'un projet, sur l'écran du projet : le chef (★) puis les
 * collaborateurs. Le chef invite par identifiant ou adresse e-mail ; toucher un
 * collaborateur ouvre « Nommer chef de projet » et « Retirer du projet ».
 * Il faut être connecté, et le projet doit être sur le serveur.
 */
export function TeamPanel({ projectId, role }: { projectId: string; role: TeamRole }) {
  const theme = useTheme();
  const t = useT();
  const s = t.projects.team;
  const session = useSession();
  useProjects(); // relit l'état de synchronisation du projet
  const ready = Boolean(session) && (role === 'collaborateur' || isProjectSynced(projectId));
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const isChef = role === 'chef';

  const fetchTeam = useCallback(
    () =>
      listTeam(projectId).then(setTeam, (cause: unknown) =>
        setLoadError(cause instanceof Error ? cause.message : getT().projects.team.loadError),
      ),
    [projectId],
  );

  useEffect(() => {
    if (ready) fetchTeam();
  }, [ready, fetchTeam, role]);

  const invite = async () => {
    const value = who.trim();
    setDone(null);
    if (!value) return setError(s.whoEmpty);
    setBusy(true);
    setError(null);
    try {
      const member = await inviteToProject(projectId, value);
      setTeam((list) => [...(list ?? []).filter((item) => item.id !== member.id), member]);
      setDone(s.invited(personName(member)));
      setWho('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : s.loadError);
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<void>, message?: string) => {
    setError(null);
    setDone(null);
    try {
      await action();
      if (message) setDone(message);
      await fetchTeam();
      syncNow(); // mes projets et ceux de l'équipe se relisent
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : s.loadError);
    }
  };

  const actions: SheetAction[] = selected
    ? [
        {
          label: s.makeChef,
          icon: { ios: 'star', android: 'star' },
          onPress: () =>
            confirmAction(
              s.makeChefTitle(personName(selected)),
              s.makeChefText(personName(selected)),
              s.makeChef,
              () => run(() => transferChef(projectId, selected.id), s.makeChefDone(personName(selected))),
              t.common.cancel,
            ),
        },
        {
          label: s.remove,
          icon: { ios: 'person.badge.minus', android: 'person_remove' },
          destructive: true,
          onPress: () =>
            confirmAction(
              s.removeTitle,
              s.removeText(personName(selected)),
              s.remove,
              () => run(() => removeFromTeam(projectId, selected.id)),
              t.common.cancel,
            ),
        },
      ]
    : [];

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder }];

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
          {s.section(team?.length ?? (isChef ? 1 : 2))}
        </ThemedText>
        <HelpButton title={s.section(team?.length ?? 0)} text={s.help} />
      </View>

      {!session && <Notice text={s.signIn} />}
      {session && !ready && <Notice text={s.notSynced} />}
      {ready && !team && !loadError && (
        <View style={styles.loading} accessibilityLabel={s.loading}>
          <ActivityIndicator color={theme.link} />
        </View>
      )}
      {loadError && <Notice text={loadError} tone="danger" />}

      {team?.map((member) => {
        const me = member.id === session?.user.id;
        const canManage = isChef && member.role === 'collaborateur';
        const name = personName(member);
        const content = (
          <>
            <View style={[styles.avatar, { backgroundColor: theme.primaryBackground }]}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                {initials(name.replace(/^@/, ''))}
              </ThemedText>
            </View>
            <View style={styles.text}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {me ? `${name} (${s.you})` : name}
              </ThemedText>
              {member.username && (
                <ThemedText type="small" themeColor="textSecondary">
                  @{member.username}
                </ThemedText>
              )}
            </View>
            <Badge
              label={member.role === 'chef' ? `★ ${t.projects.chefBadge}` : s.collaborator}
              tone={member.role === 'chef' ? 'primary' : 'neutral'}
            />
            {canManage && (
              <SymbolView name={{ ios: 'ellipsis', android: 'more_horiz' }} size={18} tintColor={theme.textSecondary} />
            )}
          </>
        );
        return canManage ? (
          <Pressable
            key={member.id}
            onPress={() => setSelected(member)}
            accessibilityRole="button"
            accessibilityLabel={s.memberMenu(name)}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceMuted : theme.surface }]}>
            {content}
          </Pressable>
        ) : (
          <View key={member.id} style={[styles.row, { backgroundColor: theme.surface }]}>
            {content}
          </View>
        );
      })}

      {ready && isChef && team && (
        <View style={styles.field}>
          <ThemedText type="smallBold">{s.whoLabel}</ThemedText>
          <TextInput
            value={who}
            onChangeText={(text) => {
              setWho(text);
              setError(null);
            }}
            placeholder={s.whoPlaceholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={s.whoLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={invite}
            style={input}
          />
          <PrimaryButton label={busy ? s.inviting : s.invite} onPress={invite} disabled={busy} />
        </View>
      )}

      {error && <Notice text={error} tone="danger" />}
      {done && <Notice text={done} tone="success" />}

      <ActionSheet
        visible={selected !== null}
        title={selected ? s.memberMenu(personName(selected)) : ''}
        actions={actions}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function Notice({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' | 'success' }) {
  const theme = useTheme();
  const colors = {
    neutral: { background: theme.surface, text: theme.textSecondary },
    danger: { background: theme.dangerBackground, text: theme.danger },
    success: { background: theme.successBackground, text: theme.success },
  }[tone];
  return (
    <View
      style={[styles.notice, { backgroundColor: colors.background }]}
      accessibilityRole={tone === 'neutral' ? undefined : 'alert'}>
      <ThemedText type="small" style={{ color: colors.text }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.two, marginTop: Spacing.three },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loading: { paddingVertical: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    padding: Spacing.three - Spacing.half,
    borderRadius: Radius.large,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.half },
  field: { gap: Spacing.two, marginTop: Spacing.two },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  notice: { padding: Spacing.three, borderRadius: Radius.medium },
});
