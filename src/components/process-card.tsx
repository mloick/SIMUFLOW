import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { PressableScale } from '@/components/pressable-scale';
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

/**
 * Carte d'un process dans la liste (refonte) : une tuile à gauche, le nom, la
 * source ou la personne qui le partage, les chiffres, et la pastille du
 * diagnostic. Toute la carte ouvre le détail et se tasse sous le doigt.
 * `sharedBy` : process partagé avec moi, par qui.
 */
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
  const origin = sharedBy ? t.card.sharedBy(sharedBy) : source;
  // La tuile prend la couleur du diagnostic quand il y a quelque chose à corriger.
  const tile = {
    danger: { background: theme.dangerBackground, tint: theme.danger },
    warning: { background: theme.warningBackground, tint: theme.warning },
  }[badge.tone as 'danger' | 'warning'] ?? { background: theme.primaryBackground, tint: theme.link };

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/process/[id]', params: { id: process.id } })}
      accessibilityRole="button"
      accessibilityLabel={[
        process.name,
        sharedBy && t.card.sharedBy(sharedBy),
        meta,
        badge.label,
        !sharedBy && source && t.card.source(source),
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t.card.openHint}
      style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={[styles.tile, { backgroundColor: tile.background }]}>
        <SymbolView
          name={
            sharedBy
              ? { ios: 'person.2', android: 'group' }
              : { ios: 'point.3.connected.trianglepath.dotted', android: 'account_tree' }
          }
          size={22}
          tintColor={tile.tint}
        />
      </View>
      <View style={styles.body}>
        <ThemedText style={styles.title} numberOfLines={2}>
          {process.name}
        </ThemedText>
        {origin && (
          <ThemedText type="small" numberOfLines={1} style={{ color: sharedBy ? theme.link : theme.textSecondary }}>
            {origin}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {meta}
        </ThemedText>
        <View style={styles.badge}>
          <Badge label={badge.label} tone={badge.tone} />
        </View>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} tintColor={theme.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radius.large,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
  badge: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
});
