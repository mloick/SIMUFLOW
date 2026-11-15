import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Largeur et hauteur du dessin (points). Plus étroit, l'écran coupe les bords. */
export const ILLUSTRATION_WIDTH = 390;
export const ILLUSTRATION_HEIGHT = 330;

/** Le chemin en S du logo, en grand. Sa longueur sert à le « tracer » (pointillé qui se découvre). */
const TRAIL = 'M78 120 H262 A52 52 0 0 1 262 224 H128 A52 52 0 0 0 128 328 H330';
const TRAIL_LENGTH = 900;

/**
 * Illustration du lancement : le chemin en S se trace, et des étapes de process
 * (départ, étape, décision, fin) apparaissent dessus l'une après l'autre.
 * Purement décorative (cachée aux lecteurs d'écran). Avec « Réduire les
 * animations », tout est affiché d'un coup. `top` décale le dessin vers le bas
 * (sous la barre d'état), le fond et les cercles montant jusqu'en haut.
 */
export function LaunchIllustration({ top = 0 }: { top?: number }) {
  const theme = useTheme();
  const t = useT();
  const labels = t.signIn.illustration;
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(reduceMotion ? 0 : TRAIL_LENGTH);

  useEffect(() => {
    if (reduceMotion) return;
    offset.value = withDelay(150, withTiming(0, { duration: 1400, easing: Easing.bezier(0.6, 0, 0.2, 1) }));
  }, [offset, reduceMotion]);

  const trailProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const appear = (delay: number) => (reduceMotion ? undefined : FadeInDown.duration(450).delay(delay));
  const chip = [styles.chip, { backgroundColor: theme.surface, shadowColor: theme.text }];

  return (
    <View
      style={[styles.box, { backgroundColor: theme.primaryBackground, height: ILLUSTRATION_HEIGHT + top }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT + top} style={StyleSheet.absoluteFill}>
        <Circle cx={340} cy={20} r={110} fill={theme.primary} opacity={0.07} />
        <Circle cx={30} cy={300 + top} r={80} fill={theme.accent} opacity={0.1} />
        <AnimatedPath
          y={top}
          d={TRAIL}
          fill="none"
          stroke={theme.primary}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={TRAIL_LENGTH}
          animatedProps={trailProps}
        />
      </Svg>

      <Animated.View
        entering={appear(100)}
        style={[styles.start, { backgroundColor: theme.text, left: 50, top: top + 98 }]}>
        <ThemedText type="smallBold" style={[styles.chipText, { color: theme.background }]}>
          {labels.start}
        </ThemedText>
      </Animated.View>
      <Animated.View entering={appear(500)} style={[chip, { left: 150, top: top + 96 }]}>
        <View style={[styles.dot, { backgroundColor: theme.primary }]} />
        <ThemedText type="smallBold" style={styles.chipText}>
          {labels.step}
        </ThemedText>
      </Animated.View>
      <Animated.View
        entering={appear(800)}
        style={[styles.decision, { backgroundColor: theme.primary, left: 286, top: top + 152 }]}
      />
      <Animated.View entering={appear(1000)} style={[chip, { left: 136, top: top + 202 }]}>
        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
        <ThemedText type="smallBold" style={styles.chipText}>
          {labels.wait}
        </ThemedText>
      </Animated.View>
      <Animated.View
        entering={appear(1200)}
        style={[styles.end, { backgroundColor: theme.accent, left: 308, top: top + 300 }]}>
        <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={20} tintColor="#ffffff" weight="bold" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: ILLUSTRATION_WIDTH,
    alignSelf: 'center',
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  start: {
    position: 'absolute',
    width: 64,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decision: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 10,
    transform: [{ rotate: '45deg' }],
  },
  end: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
