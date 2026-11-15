import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const WIDTHS = ['70%', '55%', '80%', '60%'] as const;

/**
 * État « chargement » (refonte R7) : la forme des nouvelles cartes (tuile,
 * nom, chiffres), sans spinner. Un reflet clair les traverse en boucle ; avec
 * « Réduire les animations », elles restent immobiles.
 */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  const theme = useTheme();
  const t = useT();
  const bar = { backgroundColor: theme.surfaceMuted };
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
  }, [progress, reduceMotion]);

  const shine = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 0.5,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-120, 420]) }, { skewX: '-20deg' }],
  }));

  return (
    <View style={styles.list} accessible accessibilityLabel={t.list.loading} accessibilityState={{ busy: true }}>
      {WIDTHS.slice(0, count).map((width, index) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={[styles.tile, bar]} />
          <View style={styles.lines}>
            <View style={[styles.bar, styles.title, bar, { width }]} />
            <View style={[styles.bar, styles.meta, bar]} />
          </View>
          <Animated.View pointerEvents="none" style={[styles.shine, { backgroundColor: theme.border }, shine]} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 15,
  },
  lines: {
    flex: 1,
    gap: Spacing.two,
  },
  bar: {
    borderRadius: Radius.pill,
  },
  title: { height: 14 },
  meta: { width: '50%', height: 10 },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 60,
  },
});
