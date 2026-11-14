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
import { plural } from '@/utils/format';

/** « 2 membres sur 3 ont fini · 1 étape à revoir », ou « Process entièrement validé ». */
export function validationSummary(overview: ValidationOverview): string {
  const count = overview.members.length;
  if (overview.fullyValidated) {
    return count > 1 ? `Process entièrement validé par les ${count} membres.` : 'Process entièrement validé.';
  }
  const done =
    overview.doneCount === 0
      ? `Aucun membre n’a encore fini (${plural(count, 'membre')})`
      : `${overview.doneCount} membre${overview.doneCount > 1 ? 's' : ''} sur ${count} ${overview.doneCount > 1 ? 'ont' : 'a'} fini`;
  return overview.toReviseCount > 0 ? `${done} · ${plural(overview.toReviseCount, 'étape')} à revoir` : done;
}

/**
 * Sur la fiche d'un process partagé, pour son propriétaire : où en est la
 * validation. Toucher la carte ouvre « Suivi de la validation ». Rien tant
 * que personne n'est invité.
 */
export function ValidationCard({ process, cloudId }: { process: Process; cloudId: string }) {
  const theme = useTheme();
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
          {validationSummary(overview)}
        </ThemedText>
        {overview.fullyValidated ? (
          <Badge label="Validé" tone="success" />
        ) : overview.toReviseCount > 0 ? (
          <Badge label="À revoir" tone="warning" />
        ) : (
          <Badge label="En cours" />
        )}
      </>
    );
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/validation/[id]', params: { id: process.id } })}
      accessibilityRole="button"
      accessibilityHint="Ouvre le suivi de la validation, étape par étape"
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <SymbolView name={{ ios: 'checklist', android: 'checklist' }} size={22} tintColor={theme.link} />
      <View style={styles.text}>
        <ThemedText type="link" style={{ color: theme.link }}>
          Suivi de la validation
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
