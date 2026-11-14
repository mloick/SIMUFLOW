import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Process, ProcessSummary } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT, type Messages } from '@/i18n';

/** Pastille du diagnostic : les erreurs d'abord, puis les avertissements. */
export function diagnosticBadge(t: Messages, summary: ProcessSummary): { label: string; tone: BadgeTone } {
  const { count } = t.format;
  const { words } = t;
  if (summary.errorCount > 0) return { label: count(summary.errorCount, words.error), tone: 'danger' };
  if (summary.warningCount > 0) return { label: count(summary.warningCount, words.warning), tone: 'warning' };
  return { label: t.card.noIssue, tone: 'success' };
}

/** Carte d'un process dans la liste. Toute la carte ouvre le détail. `sharedBy` : process partagé avec moi, par qui. */
export function ProcessCard({
  process,
  summary,
  sharedBy,
}: {
  process: Process;
  summary: ProcessSummary;
  sharedBy?: string;
}) {
  const theme = useTheme();
  const t = useT();
  const { count } = t.format;
  const meta = [
    count(summary.stepCount, t.words.step),
    count(summary.decisionCount, t.words.decision),
    count(summary.actors.length, t.words.actor),
  ].join(' · ');
  const badge = diagnosticBadge(t, summary);
  const source = process.source ? t.sources[process.source] : undefined;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/process/[id]', params: { id: process.id } })}
      accessibilityRole="button"
      accessibilityLabel={[
        process.name,
        sharedBy && t.card.sharedBy(sharedBy),
        meta,
        badge.label,
        source && t.card.source(source),
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t.card.openHint}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
      ]}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {process.name}
        </ThemedText>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
          size={18}
          tintColor={theme.textSecondary}
        />
      </View>
      {sharedBy && (
        <View style={styles.shared}>
          <SymbolView name={{ ios: 'person.2', android: 'group' }} size={16} tintColor={theme.link} />
          <ThemedText type="small" style={{ color: theme.link }}>
            {t.card.sharedBy(sharedBy)}
          </ThemedText>
        </View>
      )}
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
  shared: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
