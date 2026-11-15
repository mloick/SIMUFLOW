import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { HelpButton } from '@/components/help-button';
import { PressableScale } from '@/components/pressable-scale';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Un groupe de réglages (refonte) : un titre en petites capitales, puis une
 * carte arrondie qui contient ses lignes (`SettingsRow`), séparées par un trait.
 */
export function SettingsGroup({
  title,
  help,
  footer,
  children,
}: {
  title: string;
  /** Explication du groupe entier, ouverte par un bouton « ? » à droite du titre. */
  help?: string;
  /** Ce qui suit la carte : une phrase d'état, un lien. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.groupTitle}>
          {title}
        </ThemedText>
        {help && <HelpButton title={title} text={help} />}
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>
      {footer}
    </View>
  );
}

/**
 * Une ligne de réglage : une icône dans une pastille teintée, le libellé, un
 * bouton « ? » si une explication est donnée (`help`), puis ce qui est à droite
 * (`right` : un interrupteur, une valeur, ou rien). Avec `onPress`, toute la
 * ligne est un bouton, avec une flèche à droite si `right` est vide.
 * `first` retire le trait du haut (première ligne du groupe).
 */
export function SettingsRow({
  icon,
  label,
  help,
  right,
  onPress,
  accessibilityRole = 'button',
  accessibilityHint,
  tone = 'default',
  first = false,
  children,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  help?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityRole?: 'button' | 'link';
  accessibilityHint?: string;
  tone?: 'default' | 'link';
  first?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: theme.primaryBackground }]}>
        <SymbolView name={icon} size={18} tintColor={theme.link} />
      </View>
      <ThemedText style={[styles.label, tone === 'link' && { color: theme.link }]}>{label}</ThemedText>
      {help && <HelpButton title={label} text={help} />}
      {right}
      {onPress && !right && (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
          size={16}
          tintColor={theme.textSecondary}
        />
      )}
    </>
  );

  return (
    <View style={!first && [styles.divider, { borderTopColor: theme.border }]}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          accessibilityRole={accessibilityRole}
          accessibilityHint={accessibilityHint}
          style={styles.row}>
          {content}
        </PressableScale>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  groupHeading: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: 800,
    marginHorizontal: Spacing.one,
  },
  card: {
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontWeight: 700,
  },
});
