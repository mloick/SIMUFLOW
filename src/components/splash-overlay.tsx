import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

/**
 * Prend le relais de l'écran de démarrage natif (même logo, même fond), puis
 * s'efface en fondu une fois l'app affichée. Sans fondu si « Réduire les
 * animations » est activé.
 */
export function SplashOverlay() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;
  return (
    <Animated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(300)}
      style={[styles.overlay, { backgroundColor: Colors[scheme].background }]}>
      <View
        onLayout={() => {
          SplashScreen.hideAsync().finally(() => setVisible(false));
        }}>
        <Image
          style={styles.logo}
          source={require('@/assets/images/splash-icon.png')}
          accessibilityIgnoresInvertColors
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logo: { width: 120, height: 120 },
});
