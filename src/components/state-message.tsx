import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/primary-button';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StateMessageProps = {
  /** Icône dans une grande tuile teintée ; ignorée si `illustration` est donnée. */
  icon?: SymbolViewProps['name'];
  /** Dessin à la place de l'icône (liste vide de l'accueil). */
  illustration?: ReactNode;
  tone: 'primary' | 'danger';
  title: string;
  message: string;
  action: { label: string; onPress: () => void };
  /** Lien sous le bouton (« Voir les exemples »). */
  secondary?: { label: string; onPress: () => void };
};

/**
 * Message plein écran des états « vide » et « erreur » (refonte R7) : une
 * grande tuile arrondie ou un dessin, un titre, une phrase, le bouton, et un
 * lien facultatif. Il arrive en glissant vers le haut, sauf avec « Réduire
 * les animations ».
 */
export function StateMessage({ icon, illustration, tone, title, message, action, secondary }: StateMessageProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const color = tone === 'danger' ? theme.danger : theme.link;
  const background = tone === 'danger' ? theme.dangerBackground : theme.primaryBackground;

  return (
    <Animated.View style={styles.container} entering={reduceMotion ? undefined : FadeInDown.duration(400)}>
      {illustration ?? (
        <View style={[styles.icon, { backgroundColor: background }]} importantForAccessibility="no-hide-descendants">
          {icon && <SymbolView name={icon} size={38} tintColor={color} />}
        </View>
      )}
      <ThemedText style={[styles.title, styles.center]} accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={[styles.message, styles.center]}>
        {message}
      </ThemedText>
      <View style={styles.button}>
        <PrimaryButton label={action.label} onPress={action.onPress} />
      </View>
      {secondary && (
        <Pressable
          onPress={secondary.onPress}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
          <ThemedText type="link" style={[styles.linkText, { color: theme.link }]}>
            {secondary.label}
          </ThemedText>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 800,
  },
  message: {
    maxWidth: 300,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.one,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  linkText: {
    fontWeight: 800,
  },
});
