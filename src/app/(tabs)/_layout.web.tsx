import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Onglets de la version web. Les onglets natifs (`NativeTabs`) deviennent dans
 * le navigateur une barre flottante en haut, qui recouvre le titre des écrans.
 * Ici, une barre en bas de l'écran, comme sur le téléphone, avec les mêmes
 * icônes (Material Symbols) et les mêmes couleurs.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const t = useT();
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="account_tree" label={t.tabs.process} />
        </TabTrigger>
        <TabTrigger name="scanner" href="/scanner" asChild>
          <TabButton icon="document_scanner" label={t.tabs.scanner} />
        </TabTrigger>
        <TabTrigger name="reglages" href="/reglages" asChild>
          <TabButton icon="tune" label={t.tabs.settings} />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = Omit<TabTriggerSlotProps, 'ref'> & {
  icon: NonNullable<Extract<SymbolViewProps['name'], object>['android']>;
  label: string;
};

/** Un onglet : icône et libellé, en bleu quand il est ouvert. */
function TabButton({ icon, label, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();
  const color = isFocused ? theme.link : theme.textSecondary;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={styles.tab}>
      <View style={[styles.pill, isFocused && { backgroundColor: theme.surfaceMuted }]}>
        <SymbolView name={{ ios: 'circle', android: icon }} size={24} tintColor={color} />
      </View>
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1, minHeight: 0 },
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  tab: { flex: 1, maxWidth: 160, alignItems: 'center', gap: 2, paddingVertical: Spacing.one },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: 2, borderRadius: 999 },
});
