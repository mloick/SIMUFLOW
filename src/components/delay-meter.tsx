import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Badge, type BadgeTone } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { fontFaceFor, Radius, Spacing } from '@/constants/theme';
import type { DelayLevel } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const TONE: Record<DelayLevel, BadgeTone> = {
  ok: 'success',
  warning: 'warning',
  late: 'danger',
};

/**
 * Chrono d'un délai (mode Délais) : un titre (« SLA client »), une grande
 * valeur (« 1 j 4 h restants »), une pastille verte, orange ou rouge, et une
 * barre qui se remplit avec le temps consommé. Une fois le délai dépassé,
 * l'icône clignote doucement (sauf si l'utilisateur réduit les animations).
 * Sert au suivi en vrai (temps restant) et à la simulation (jours cumulés).
 */
export function DelayMeter({
  title,
  value,
  caption,
  level,
  ratio,
  footer,
  accessibilityLabel,
}: {
  title: string;
  /** La grande valeur : temps restant, ou jours consommés. */
  value: string;
  /** Le mot sous la valeur : « restants », « de retard », « sur 6 jours ouvrés ». */
  caption?: string;
  level: DelayLevel;
  /** Part consommée, entre 0 et 1. */
  ratio: number;
  /** Ligne en bas : l'échéance, par exemple. */
  footer?: string;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const color = {
    ok: theme.success,
    warning: theme.warning,
    late: theme.danger,
  }[level];
  const background = {
    ok: theme.successBackground,
    warning: theme.warningBackground,
    late: theme.dangerBackground,
  }[level];

  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = level === 'late' && !reduceMotion ? withRepeat(withTiming(0.35, { duration: 800 }), -1, true) : 1;
  }, [blink, level, reduceMotion]);
  const iconStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: background }]}>
      <View style={styles.top}>
        <Animated.View style={[styles.icon, { backgroundColor: background }, iconStyle]}>
          <SymbolView name={{ ios: 'timer', android: 'timer' }} size={18} tintColor={color} />
        </Animated.View>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.flex}>
          {title}
        </ThemedText>
        <Badge label={t.delays.levels[level]} tone={TONE[level]} />
      </View>
      <View style={styles.valueRow}>
        <ThemedText style={[styles.value, { color }]}>{value}</ThemedText>
        {caption ? <ThemedText themeColor="textSecondary">{caption}</ThemedText> : null}
      </View>
      <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: `${Math.round(Math.min(1, ratio) * 100)}%`,
            },
          ]}
        />
      </View>
      {footer ? (
        <ThemedText type="small" themeColor="textSecondary">
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  value: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
    fontFamily: fontFaceFor(800),
    fontVariant: ['tabular-nums'],
  },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
