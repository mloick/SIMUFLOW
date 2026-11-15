import { ScrollView, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export type FilterChip<T extends string> = { id: T; label: string; count: number };

/**
 * Filtres en pastilles qui défilent de côté : la pastille choisie est foncée
 * (couleur du texte), les autres sur fond de carte. Chacune montre son nombre.
 */
export function FilterChips<T extends string>({
  chips,
  current,
  onChange,
}: {
  chips: FilterChip<T>[];
  current: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t.list.filters}
      style={styles.scroll}
      contentContainerStyle={styles.row}>
      {chips.map((chip) => {
        const active = chip.id === current;
        const color = active ? theme.background : theme.text;
        return (
          <PressableScale
            key={chip.id}
            onPress={() => onChange(chip.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.list.filterLabel(chip.label, chip.count)}
            style={[styles.chip, { backgroundColor: active ? theme.text : theme.surface }]}>
            <ThemedText type="smallBold" style={[styles.label, { color }]}>
              {chip.label}{' '}
              <ThemedText type="smallBold" style={[styles.count, { color }]}>
                {chip.count}
              </ThemedText>
            </ThemedText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    marginHorizontal: -Spacing.three,
  },
  row: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: Radius.pill,
  },
  label: {
    fontWeight: 700,
  },
  count: {
    opacity: 0.7,
  },
});
