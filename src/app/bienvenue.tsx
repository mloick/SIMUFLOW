import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { SimuflowLogo } from '@/components/simuflow-logo';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { setWelcomeSeen } from '@/data/welcome-setting';
import { useTheme } from '@/hooks/use-theme';

type Page = { icon?: SymbolViewProps['name']; title: string; text: string };

const PAGES: Page[] = [
  {
    title: 'Bienvenue dans SimuFlow',
    text: 'Validez vos process avant de les mettre en place : rejouez-les étape par étape et repérez ce qui coince.',
  },
  {
    icon: { ios: 'square.and.arrow.down', android: 'download' },
    title: 'Ajoutez vos process',
    text: 'Importez un schéma draw.io ou un fichier JSON, ou photographiez un tableau avec le Scanner. Quatre exemples sont là pour essayer tout de suite.',
  },
  {
    icon: { ios: 'play.circle', android: 'play_circle' },
    title: 'Rejouez et corrigez',
    text: 'Simulez pas à pas, voyez tous les cas d’un coup et le chemin le plus long, corrigez le process dans l’app, puis exportez le schéma.',
  },
  {
    icon: { ios: 'bell.badge', android: 'notifications_active' },
    title: 'Suivez une vraie demande',
    text: 'Suivez une demande en jours ouvrés : SimuFlow vous rappelle ses échéances. Créez un compte dans le Profil pour retrouver vos process sur tous vos appareils.',
  },
];

/** Présentation du premier lancement, en quatre pages. Revoyable depuis le Profil. */
export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const page = PAGES[index];
  const last = index === PAGES.length - 1;

  const finish = () => {
    setWelcomeSeen();
    // Revient aux onglets, même si la présentation est le premier écran affiché.
    router.dismissTo('/');
  };

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.top}>
        {!last && (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12} style={styles.skip}>
            <ThemedText type="link">Passer</ThemedText>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          key={index}
          entering={reduceMotion ? undefined : FadeIn.duration(250)}
          style={styles.page}
          accessibilityLiveRegion="polite">
          {page.icon ? (
            <View
              style={[styles.icon, { backgroundColor: theme.primaryBackground }]}
              importantForAccessibility="no-hide-descendants">
              <SymbolView name={page.icon} size={40} tintColor={theme.primary} />
            </View>
          ) : (
            <SimuflowLogo size={96} />
          )}
          <ThemedText type="title" style={styles.center} accessibilityRole="header">
            {page.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.center, styles.text]}>
            {page.text}
          </ThemedText>
        </Animated.View>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} sur ${PAGES.length}`}>
          {PAGES.map((item, dot) => (
            <View
              key={item.title}
              style={[styles.dot, { backgroundColor: dot === index ? theme.primary : theme.fieldBorder }]}
            />
          ))}
        </View>
        <PrimaryButton label={last ? 'Commencer' : 'Suivant'} onPress={last ? finish : () => setIndex(index + 1)} />
        {/* Toujours à sa place, invisible sur la première page : les boutons ne sautent pas. */}
        <Pressable
          onPress={() => setIndex(index - 1)}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityElementsHidden={index === 0}
          importantForAccessibility={index === 0 ? 'no-hide-descendants' : 'auto'}
          hitSlop={8}
          style={[styles.previous, { opacity: index === 0 ? 0 : 1 }]}>
          <ThemedText type="link">Précédent</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { minHeight: 48, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: Spacing.four },
  skip: { minHeight: 44, justifyContent: 'center' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  page: { alignItems: 'center', gap: Spacing.four },
  icon: { width: 96, height: 96, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  text: { fontSize: 18, lineHeight: 26 },
  bottom: {
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  previous: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
