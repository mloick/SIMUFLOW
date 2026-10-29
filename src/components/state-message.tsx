import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StateMessageProps = {
  icon: SymbolViewProps['name'];
  tone: 'primary' | 'danger';
  title: string;
  message: string;
  action: { label: string; onPress: () => void };
};

/** Message plein écran des états « vide » et « erreur » de la maquette. */
export function StateMessage({ icon, tone, title, message, action }: StateMessageProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.primary;
  const background = tone === 'danger' ? theme.dangerBackground : theme.primaryBackground;

  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: background }]} importantForAccessibility="no-hide-descendants">
        <SymbolView name={icon} size={32} tintColor={color} />
      </View>
      <ThemedText type="subtitle" style={styles.center} accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <PrimaryButton label={action.label} onPress={action.onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
