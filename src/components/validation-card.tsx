import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useValidationData } from '@/data/validation-data';
import { validationOverview, type Process, type ValidationOverview } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT, type Messages } from '@/i18n';

/** « 2 membres sur 3 ont fini · 1 étape à revoir », ou « Process entièrement validé ». */
export function validationSummary(t: Messages, overview: ValidationOverview): string {
  const text = t.validationCard;
  const count = overview.members.length;
  if (overview.fullyValidated) return text.allValidated(count);
  const done =
    overview.doneCount === 0
      ? text.noneDone(t.format.count(count, t.words.member))
      : text.done(overview.doneCount, count);
  return overview.toReviseCount > 0
    ? `${done} · ${text.toRevise(t.format.count(overview.toReviseCount, t.words.step))}`
    : done;
}

/**
 * Sur la fiche d'un process partagé, pour son propriétaire : où en est la
 * validation. Toucher la carte ouvre « Suivi de la validation ». Rien tant
 * que personne n'est invité.
 */
export function ValidationCard({ process, cloudId }: { process: Process; cloudId: string }) {
  const theme = useTheme();
  const t = useT();
  const data = useValidationData(cloudId);
  const overview = useMemo(
    () => (data.status === 'ready' ? validationOverview(process, data.members, data.reviews) : null),
    [data, process],
  );

  if (data.status === 'ready' && data.members.length === 0) return null;

  let body;
  if (data.status === 'loading') {
    body = <ActivityIndicator color={theme.textSecondary} />;
  } else if (data.status === 'error') {
    body = (
      <ThemedText type="small" style={{ color: theme.danger }}>
        {data.message}
      </ThemedText>
    );
  } else if (overview) {
    body = (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          {validationSummary(t, overview)}
        </ThemedText>
        {overview.fullyValidated ? (
          <Badge label={t.validationCard.validated} tone="success" />
        ) : overview.toReviseCount > 0 ? (
          <Badge label={t.validationCard.revise} tone="warning" />
        ) : (
          <Badge label={t.validationCard.inProgress} />
        )}
      </>
    );
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/validation/[id]', params: { id: process.id } })}
      accessibilityRole="button"
      accessibilityHint={t.validationCard.hint}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <SymbolView name={{ ios: 'checklist', android: 'checklist' }} size={22} tintColor={theme.link} />
      <View style={styles.text}>
        <ThemedText type="link" style={{ color: theme.link }}>
          {t.validationCard.title}
        </ThemedText>
        {body}
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={16} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: Spacing.one, alignItems: 'flex-start' },
});
