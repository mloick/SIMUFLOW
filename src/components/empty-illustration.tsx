import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const LENGTH = 260;

/**
 * Dessin de la liste vide (refonte R7) : le chemin en S du logo se trace sur un
 * disque teinté, à partir d'un point de départ. Décoratif, caché aux lecteurs
 * d'écran. Avec « Réduire les animations », il est dessiné d'un coup.
 */
export function EmptyIllustration() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(reduceMotion ? 0 : LENGTH);

  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
      return;
    }
    offset.value = withDelay(150, withTiming(0, { duration: 1300, easing: Easing.bezier(0.6, 0, 0.2, 1) }));
  }, [offset, reduceMotion]);

  const traced = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={170} height={130} viewBox="0 0 170 130">
        <Circle cx={85} cy={65} r={62} fill={theme.primaryBackground} />
        <AnimatedPath
          d="M40 40 H110 A22 22 0 0 1 110 84 H60 A22 22 0 0 0 60 128"
          fill="none"
          stroke={theme.primary}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={[LENGTH, LENGTH]}
          animatedProps={traced}
        />
        <Circle cx={40} cy={40} r={9} fill={theme.text} />
      </Svg>
    </View>
  );
}
