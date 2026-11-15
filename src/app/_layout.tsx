import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashOverlay } from '@/components/splash-overlay';
import { FontFaces, type ThemeColors } from '@/constants/theme';
import { useCloudSync } from '@/data/cloud-sync';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { configureNotifications } from '@/notifications/notifications';
import { useDeadlineReminders } from '@/notifications/use-deadline-reminders';
import { useShareAlertNavigation } from '@/notifications/use-share-alert-taps';

// Les onglets restent toujours sous les écrans modaux (présentation du premier lancement).
export const unstable_settings = { anchor: '(tabs)' };

SplashScreen.preventAutoHideAsync();
// Notifications locales : affichées même quand l'app est ouverte.
configureNotifications();

/** Thème de navigation (en-têtes, fonds) construit à partir de la palette et de la police SimuFlow. */
function navigationTheme(scheme: 'light' | 'dark', colors: ThemeColors) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    fonts: {
      regular: { fontFamily: FontFaces.regular, fontWeight: 'normal' as const },
      medium: { fontFamily: FontFaces.medium, fontWeight: 'normal' as const },
      bold: { fontFamily: FontFaces.bold, fontWeight: 'normal' as const },
      heavy: { fontFamily: FontFaces.extraBold, fontWeight: 'normal' as const },
    },
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
  const colors = useTheme();
  const t = useT();
  // Police Plus Jakarta Sans : l'écran de démarrage reste affiché le temps de la charger.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Process importés synchronisés avec le compte connecté.
  useCloudSync();
  // Rappels d'échéance des demandes suivies, et ouverture d'un suivi depuis un rappel.
  useDeadlineReminders();
  // Alertes du partage : toucher l'alerte ouvre le process ou son suivi.
  useShareAlertNavigation();
  // Si la police ne se charge pas, l'app s'affiche quand même, avec celle du système.
  if (!fontsLoaded && !fontError) return null;
  return (
    // Racine des gestes (pincer et glisser sur le schéma).
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navigationTheme(scheme, colors)}>
        <SplashOverlay />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="connexion" options={{ title: t.titles.signIn, presentation: 'modal' }} />
          <Stack.Screen name="profil" options={{ title: t.titles.profile }} />
          <Stack.Screen name="mon-profil" options={{ title: t.titles.myProfile, presentation: 'modal' }} />
          <Stack.Screen
            name="bienvenue"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="nouveau-mot-de-passe" options={{ title: t.titles.newPassword }} />
          <Stack.Screen name="process/[id]" options={{ title: t.titles.process }} />
          <Stack.Screen name="process/modifier/[id]" options={{ title: t.titles.edit }} />
          <Stack.Screen name="simulation/[id]" options={{ title: t.titles.simulation }} />
          <Stack.Screen name="suivi/[id]" options={{ title: t.titles.tracking }} />
          <Stack.Screen name="import" options={{ title: t.titles.import, presentation: 'modal' }} />
          <Stack.Screen name="formulaire" options={{ title: t.titles.form, presentation: 'modal' }} />
          <Stack.Screen name="formulaire-modifier" options={{ title: t.titles.editForm, presentation: 'modal' }} />
          <Stack.Screen name="export/[id]" options={{ title: t.titles.export, presentation: 'modal' }} />
          <Stack.Screen name="partage/[id]" options={{ title: t.titles.share, presentation: 'modal' }} />
          <Stack.Screen name="ma-partie/[id]" options={{ title: t.titles.myPart }} />
          <Stack.Screen name="validation/[id]" options={{ title: t.titles.validation }} />
          <Stack.Screen name="alertes" options={{ title: t.titles.alerts }} />
          <Stack.Screen name="lien/[token]" options={{ title: t.titles.link }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
