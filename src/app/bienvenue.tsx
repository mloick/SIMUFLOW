import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { SimuflowLogo } from '@/components/simuflow-logo';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { setWelcomeSeen } from '@/data/welcome-setting';
import { useTheme } from '@/hooks/use-theme';
import { useT, type Messages } from '@/i18n';
import { installSteps } from '@/utils/install-guide';
import { installPlatform } from '@/utils/install-guide-platform';

type Page = { icon?: SymbolViewProps['name']; title: string; text: string; steps?: string[] };

const ICONS: SymbolViewProps['name'][] = [
  { ios: 'square.and.arrow.down', android: 'download' },
  { ios: 'play.circle', android: 'play_circle' },
  { ios: 'bell.badge', android: 'notifications_active' },
];

/**
 * Pages de la présentation, dans la langue de l'app. Dans un navigateur (web
 * app pas encore installée), la deuxième page explique comment ajouter
 * SimuFlow à l'écran d'accueil.
 */
function buildPages(t: Messages): Page[] {
  const pages: Page[] = t.welcome.pages.map((page, index) => ({ ...page, icon: ICONS[index - 1] }));
  const platform = installPlatform();
  if (!platform) return pages;
  const install: Page = {
    title: t.welcome.installTitle,
    text: t.welcome.installText[platform],
    steps: installSteps(platform),
  };
  return [pages[0], install, ...pages.slice(1)];
}

/** Présentation du premier lancement, en quatre pages. Revoyable depuis le Profil. */
export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const t = useT();
  const pages = useMemo(() => buildPages(t), [t]);
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;

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
            <ThemedText type="link">{t.welcome.skip}</ThemedText>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          key={index}
          entering={reduceMotion ? undefined : FadeIn.duration(250)}
          style={styles.page}
          accessibilityLiveRegion="polite">
          {/* Une page d'étapes n'a pas d'icône : tout doit tenir sur l'écran d'un téléphone. */}
          {page.steps ? null : page.icon ? (
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
          <ThemedText themeColor="textSecondary" style={[styles.center, page.steps ? undefined : styles.text]}>
            {page.text}
          </ThemedText>
          {page.steps && (
            <View style={[styles.steps, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {page.steps.map((step, number) => (
                <View key={step} style={styles.step}>
                  <View style={[styles.number, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.numberText, { color: theme.onPrimary }]}>{number + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>{step}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots} accessible accessibilityLabel={t.welcome.pageOf(index + 1, pages.length)}>
          {pages.map((item, dot) => (
            <View
              key={item.title}
              style={[styles.dot, { backgroundColor: dot === index ? theme.primary : theme.fieldBorder }]}
            />
          ))}
        </View>
        <PrimaryButton
          label={last ? t.welcome.start : t.welcome.next}
          onPress={last ? finish : () => setIndex(index + 1)}
        />
        {/* Toujours à sa place, invisible sur la première page : les boutons ne sautent pas. */}
        <Pressable
          onPress={() => setIndex(index - 1)}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityElementsHidden={index === 0}
          importantForAccessibility={index === 0 ? 'no-hide-descendants' : 'auto'}
          hitSlop={8}
          style={[styles.previous, { opacity: index === 0 ? 0 : 1 }]}>
          <ThemedText type="link">{t.welcome.previous}</ThemedText>
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
  steps: {
    alignSelf: 'stretch',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  step: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  number: { width: 28, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontWeight: '700', fontSize: 15, lineHeight: 20 },
  stepText: { flex: 1 },
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
