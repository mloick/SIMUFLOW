import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export type SheetAction = {
  label: string;
  icon: SymbolViewProps['name'];
  onPress: () => void;
  destructive?: boolean;
};

/**
 * Menu « … » de la refonte : une feuille qui monte du bas avec une ligne par
 * action. Toucher une action ferme la feuille puis la lance ; on ferme aussi en
 * touchant à côté ou avec le geste retour.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.help.close}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <ThemedText style={styles.title} accessibilityRole="header">
            {title}
          </ThemedText>
          {actions.map((action) => {
            const color = action.destructive ? theme.danger : theme.text;
            return (
              <Pressable
                key={action.label}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.border : theme.surfaceMuted }]}>
                <SymbolView name={action.icon} size={20} tintColor={color} />
                <ThemedText style={[styles.label, { color }]}>{action.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 10, 18, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.four - Spacing.half,
    paddingTop: Spacing.three - Spacing.half,
    gap: Spacing.three - Spacing.half,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: 800,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small + 2,
  },
  label: {
    flex: 1,
    fontWeight: 700,
  },
});
