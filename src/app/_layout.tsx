import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashOverlay } from '@/components/splash-overlay';
import { Colors } from '@/constants/theme';
import { useCloudSync } from '@/data/cloud-sync';

SplashScreen.preventAutoHideAsync();

/** Thème de navigation (en-têtes, fonds) construit à partir des couleurs SimuFlow. */
function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.link,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Process importés synchronisés avec le compte connecté.
  useCloudSync();
  return (
    // Racine des gestes (pincer et glisser sur le schéma).
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navigationTheme(scheme)}>
        <SplashOverlay />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="connexion" options={{ title: 'Connexion', presentation: 'modal' }} />
          <Stack.Screen name="process/[id]" options={{ title: 'Process' }} />
          <Stack.Screen name="process/modifier/[id]" options={{ title: 'Modifier' }} />
          <Stack.Screen name="simulation/[id]" options={{ title: 'Simulation' }} />
          <Stack.Screen name="import" options={{ title: 'Importer un process', presentation: 'modal' }} />
          <Stack.Screen name="export/[id]" options={{ title: 'Exporter le schéma', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
