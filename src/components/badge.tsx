import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

/** Pastille de la maquette : état du diagnostic ou source du process. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const colors = {
    success: { text: theme.success, background: theme.successBackground },
    warning: { text: theme.warning, background: theme.warningBackground },
    danger: { text: theme.danger, background: theme.dangerBackground },
    neutral: { text: theme.textSecondary, background: theme.surfaceMuted },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <ThemedText type="smallBold" style={{ color: colors.text }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.one,
  },
});
