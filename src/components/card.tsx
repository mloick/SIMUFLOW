import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Carte arrondie de la refonte : fond `surface`, coins de 22 points. Avec
 * `onPress`, toute la carte devient un bouton qui se tasse sous le doigt ;
 * donner alors un `accessibilityLabel` qui résume son contenu.
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const cardStyle = [styles.card, { backgroundColor: theme.surface }, style];

  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={cardStyle}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
