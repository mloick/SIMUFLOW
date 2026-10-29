import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * État « chargement » : la forme des cartes, sans spinner (maquette, état 1).
 * Les cartes « respirent » doucement (opacité), sauf si « Réduire les
 * animations » est activé dans les réglages du téléphone.
 */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useTheme();
  const bar = { backgroundColor: theme.field };
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    // Aller-retour infini entre opaque et à moitié transparent.
    opacity.value = withRepeat(withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.list, pulse]}
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
    </Animated.View>
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
