import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PlaceholderLink = {
  label: string;
  href: Href;
};

type PlaceholderScreenProps = {
  title: string;
  description: string;
  links?: PlaceholderLink[];
  children?: ReactNode;
};

/**
 * Écran provisoire du squelette : un titre, ce que l'écran fera, et des liens
 * vers les écrans suivants. Il sera remplacé écran par écran par la maquette.
 */
export function PlaceholderScreen({ title, description, links = [], children }: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <ThemedText type="title" accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{description}</ThemedText>

      {links.length > 0 && (
        <ThemedView type="surface" style={[styles.links, { borderColor: theme.border }]}>
          {links.map((link) => (
            <Link key={link.label} href={link.href} style={styles.link} accessibilityRole="link">
              <ThemedText type="link">{link.label} →</ThemedText>
            </Link>
          ))}
        </ThemedView>
      )}

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  links: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  link: {
    paddingVertical: Spacing.two,
  },
});
