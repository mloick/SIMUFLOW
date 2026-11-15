import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Zone à toucher qui se tasse légèrement sous le doigt (96 %), puis revient.
 * Avec « Réduire les animations », rien ne bouge : elle s'éclaircit seulement.
 */
export function PressableScale({
  children,
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() =>
    reduceMotion ? { opacity: 1 - pressed.value * 0.25 } : { transform: [{ scale: 1 - pressed.value * 0.04 }] },
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: 120 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, { duration: 160 });
        onPressOut?.(event);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
