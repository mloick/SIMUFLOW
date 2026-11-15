import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const WIDTH = 52;
const HEIGHT = 32;
const THUMB = 26;
const PAD = 3;

/**
 * Interrupteur de la refonte (52 × 32) : la pastille glisse et le fond prend la
 * couleur de la palette. Lu comme un interrupteur par VoiceOver et TalkBack.
 * Avec « Réduire les animations », il change d'état sans glisser.
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.value = reduceMotion ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, reduceMotion, on]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [theme.fieldBorder, theme.primary]),
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * (WIDTH - THUMB - PAD * 2) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={{ opacity: disabled ? 0.45 : 1 }}>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.thumb, { backgroundColor: theme.onPrimary }, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
  },
});
