import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connexion" options={{ title: 'Connexion', presentation: 'modal' }} />
        <Stack.Screen name="process/[id]" options={{ title: 'Process' }} />
        <Stack.Screen name="simulation/[id]" options={{ title: 'Simulation' }} />
        <Stack.Screen name="import" options={{ title: 'Importer un process', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
