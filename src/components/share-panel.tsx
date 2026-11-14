import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { inviteMember, listMembers, memberName, removeMember, type Member } from '@/backend/sharing';
import { ActorLinks } from '@/components/actor-links';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { summarize, type Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { getT, useT } from '@/i18n';
import { confirmAction } from '@/utils/confirm';

/**
 * Partage d'un process déjà sur le compte (`cloudId`) : inviter un membre par
 * son identifiant ou son adresse e-mail, pour un acteur du schéma ou pour tout
 * le process ; voir et retirer les membres.
 */
export function SharePanel({ process, cloudId }: { process: Process; cloudId: string }) {
  const theme = useTheme();
  const t = useT();
  const s = t.share;
  const actors = useMemo(() => summarize(process).actors, [process]);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [actor, setActor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const fetchMembers = useCallback(
    () =>
      listMembers(cloudId).then(setMembers, (cause: unknown) =>
        setLoadError(cause instanceof Error ? cause.message : getT().share.membersError),
      ),
    [cloudId],
  );

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const load = () => {
    setLoadError(null);
    setMembers(null);
    fetchMembers();
  };

  const invite = async () => {
    const value = who.trim();
    setDone(null);
    if (!value) return setError(s.whoEmpty);
    setBusy(true);
    setError(null);
    try {
      const member = await inviteMember(cloudId, value, actor);
      setMembers((list) => [...(list ?? []).filter((item) => item.id !== member.id), member]);
      setDone(s.invited(memberName(member), member.actor));
      setWho('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : s.inviteError);
    } finally {
      setBusy(false);
    }
  };

  const remove = (member: Member) =>
    confirmAction(
      s.removeTitle,
      s.removeText(memberName(member), process.name),
      t.common.remove,
      async () => {
        try {
          await removeMember(cloudId, member.id);
          setMembers((list) => (list ?? []).filter((item) => item.id !== member.id));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : s.removeError);
        }
      },
      t.common.cancel,
    );

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder }];
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">{process.name}</ThemedText>
      <ThemedText themeColor="textSecondary">{s.intro}</ThemedText>

      <View style={styles.field}>
        <ThemedText type="smallBold">{s.who}</ThemedText>
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
      </View>

      {actors.length > 0 && (
        <View style={styles.field}>
          <ThemedText type="smallBold" nativeID="acteur">
            {s.forActor}
          </ThemedText>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabelledBy="acteur">
            {[null, ...actors].map((option) => {
              const selected = option === actor;
              return (
                <Pressable
                  key={option ?? '—'}
                  onPress={() => setActor(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderColor: selected ? theme.primary : theme.fieldBorder,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {option ?? s.anyActor}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {error && (
        <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        </View>
      )}
      {done && (
        <View style={[styles.notice, { backgroundColor: theme.successBackground }]} accessibilityLiveRegion="polite">
          <ThemedText type="small" style={{ color: theme.success }}>
            {done}
          </ThemedText>
        </View>
      )}

      <PrimaryButton label={busy ? s.inviting : s.invite} onPress={invite} disabled={busy} />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
          {members ? s.membersCount(members.length) : s.members}
        </ThemedText>
        {loadError ? (
          <View style={card}>
            <ThemedText style={[styles.row, { color: theme.danger }]}>{loadError}</ThemedText>
            <Pressable onPress={load} accessibilityRole="button" style={styles.row}>
              <ThemedText type="link">{t.common.retry}</ThemedText>
            </Pressable>
          </View>
        ) : members === null ? (
          <View style={[card, styles.row]}>
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        ) : members.length === 0 ? (
          <View style={card}>
            <ThemedText themeColor="textSecondary" style={styles.row}>
              {s.noMembers}
            </ThemedText>
          </View>
        ) : (
          <View style={card}>
            {members.map((member, index) => (
              <View
                key={member.id}
                style={[
                  styles.member,
                  index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}>
                <View style={styles.flex}>
                  <ThemedText>{memberName(member)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[
                      member.username && member.firstName ? `@${member.username}` : null,
                      member.actor ?? s.wholeProcess,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => remove(member)}
                  accessibilityRole="button"
                  accessibilityLabel={s.removeLabel(memberName(member))}
                  hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: theme.danger }}>
                    {t.common.remove}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {members && members.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {s.canRead(members.length, t.format.count(members.length, t.words.member))}
          </ThemedText>
        )}
      </View>

      {actors.length > 0 && <ActorLinks cloudId={cloudId} processName={process.name} actors={actors} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.half },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: { gap: Spacing.two },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  notice: { padding: Spacing.three, borderRadius: Radius.medium },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three },
  row: { minHeight: 48, paddingVertical: Spacing.three },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
});
