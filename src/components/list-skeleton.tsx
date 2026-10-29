import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** État « chargement » : la forme des cartes, sans spinner (maquette, état 1). */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useTheme();
  const bar = { backgroundColor: theme.field };

  return (
    <View
      style={styles.list}
      accessible
      accessibilityLabel="Chargement des process"
      accessibilityState={{ busy: true }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.bar, styles.title, bar]} />
          <View style={[styles.bar, styles.meta, bar]} />
          <View style={[styles.bar, styles.badge, bar]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three - Spacing.one,
  },
  card: {
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    borderRadius: Radius.pill,
  },
  title: { width: '55%', height: 18 },
  meta: { width: '75%', height: 12 },
  badge: { width: '35%', height: 24 },
});
