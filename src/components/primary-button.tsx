import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Bouton de la refonte : plein, couleur de la palette (`primary`), ou doux
 * (`secondary` : fond teinté, texte couleur lien). Se tasse sous le doigt.
 */
export function PrimaryButton({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const theme = useTheme();
  const filled = variant === 'primary';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: filled ? theme.primary : theme.primaryBackground, opacity: disabled ? 0.45 : 1 },
      ]}>
      <ThemedText type="link" style={[styles.label, { color: filled ? theme.onPrimary : theme.link }]}>
        {label}
      </ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  label: {
    fontWeight: 800,
    textAlign: 'center',
  },
});
