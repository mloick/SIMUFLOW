import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Process, ProcessSource, ProcessSummary } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/utils/format';

const SOURCE_LABELS: Record<ProcessSource, string> = { drawio: 'draw.io', scan: 'Scan', json: 'JSON' };

/** Pastille du diagnostic : les erreurs d'abord, puis les avertissements. */
export function diagnosticBadge(summary: ProcessSummary): { label: string; tone: BadgeTone } {
  if (summary.errorCount > 0) return { label: plural(summary.errorCount, 'erreur'), tone: 'danger' };
  if (summary.warningCount > 0) return { label: plural(summary.warningCount, 'avertissement'), tone: 'warning' };
  return { label: 'Aucune anomalie', tone: 'success' };
}

/** Carte d'un process dans la liste. Toute la carte ouvre le détail. */
export function ProcessCard({ process, summary }: { process: Process; summary: ProcessSummary }) {
  const theme = useTheme();
  const meta = [
    plural(summary.stepCount, 'étape'),
    plural(summary.decisionCount, 'décision'),
    plural(summary.actors.length, 'acteur'),
  ].join(' · ');
  const badge = diagnosticBadge(summary);
  const source = process.source ? SOURCE_LABELS[process.source] : undefined;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/process/[id]', params: { id: process.id } })}
      accessibilityRole="button"
      accessibilityLabel={[process.name, meta, badge.label, source && `Source : ${source}`].filter(Boolean).join('. ')}
      accessibilityHint="Ouvre le détail du process"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {process.name}
        </ThemedText>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} tintColor={theme.textSecondary} />
      </View>
      <ThemedText themeColor="textSecondary">{meta}</ThemedText>
      <View style={styles.badges}>
        <Badge label={badge.label} tone={badge.tone} />
        {source && <Badge label={source} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
