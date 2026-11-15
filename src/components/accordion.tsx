import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { HelpSheet } from '@/components/help-button';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export type AccordionTone = 'primary' | 'warning' | 'danger' | 'success';

/**
 * Section repliable de la refonte (détail d'un process) : une carte avec une
 * pastille d'icône, le titre, un court résumé à droite et une flèche ; le
 * contenu apparaît en fondu. Le bouton « ? » facultatif ouvre une explication.
 * Contrôlée (`open` + `onToggle`) ou libre (`initiallyOpen`).
 */
export function Accordion({
  icon,
  title,
  summary,
  tone = 'primary',
  help,
  initiallyOpen = false,
  open: openProp,
  onToggle,
  children,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  summary?: string;
  tone?: AccordionTone;
  help?: string;
  initiallyOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [openState, setOpenState] = useState(initiallyOpen);
  const [helpOpen, setHelpOpen] = useState(false);
  const open = openProp ?? openState;
  const toggle = () => {
    setOpenState(!open);
    onToggle?.(!open);
  };
  const colors = {
    primary: { tint: theme.link, background: theme.primaryBackground, summary: theme.textSecondary },
    warning: { tint: theme.warning, background: theme.warningBackground, summary: theme.warning },
    danger: { tint: theme.danger, background: theme.dangerBackground, summary: theme.danger },
    success: { tint: theme.success, background: theme.successBackground, summary: theme.success },
  }[tone];

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.head}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={summary ? `${title}, ${summary}` : title}
          style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.icon, { backgroundColor: colors.background }]}>
            <SymbolView name={icon} size={18} tintColor={colors.tint} />
          </View>
          <ThemedText style={styles.title} numberOfLines={2}>
            {title}
          </ThemedText>
          {summary !== undefined && (
            <ThemedText type="smallBold" style={{ color: colors.summary }}>
              {summary}
            </ThemedText>
          )}
          <SymbolView
            name={
              open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }
            }
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
        {help && (
          <Pressable
            onPress={() => setHelpOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.help.explain(title)}
            style={({ pressed }) => [styles.help, { opacity: pressed ? 0.6 : 1 }]}>
            <SymbolView
              name={{ ios: 'questionmark.circle', android: 'help' }}
              size={19}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {open && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(250)}
          style={[styles.body, { borderTopColor: theme.border }]}>
          {children}
        </Animated.View>
      )}
      {help && <HelpSheet visible={helpOpen} title={title} text={help} onClose={() => setHelpOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large - 2,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggle: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: 800,
  },
  help: {
    width: 44,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
});
