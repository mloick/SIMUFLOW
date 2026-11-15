import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/pressable-scale';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import type { Tracking } from '@/tracking/tracking';
import { currentStep } from '@/tracking/tracking';
import { useT } from '@/i18n';

/**
 * Carte « Reprendre » de l'accueil : la dernière demande suivie en vrai qui
 * n'est pas terminée, avec son étape en cours. Elle ouvre le suivi.
 */
export function ResumeCard({ tracking, process }: { tracking: Tracking; process: Process }) {
  const theme = useTheme();
  const t = useT();
  const step = currentStep(tracking);
  const title = process.steps.find((item) => item.id === step?.stepId)?.title ?? t.untitled;
  const detail = t.list.resumeStep(tracking.steps.length, title);

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/suivi/[id]', params: { id: tracking.id } })}
      accessibilityRole="button"
      accessibilityLabel={[t.list.resume, process.name, tracking.label, detail].join('. ')}
      accessibilityHint={t.list.resumeHint}
      style={[styles.card, { backgroundColor: theme.primary }]}>
      {/* Le chemin en S du logo, en filigrane. */}
      <Svg width={160} height={90} viewBox="0 0 160 90" style={styles.watermark} pointerEvents="none">
        <Path
          d="M10 20 H100 A25 25 0 0 1 100 70 H40"
          fill="none"
          stroke={theme.onPrimary}
          strokeWidth={10}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.body}>
        <ThemedText type="smallBold" style={[styles.kicker, { color: theme.onPrimary }]}>
          {t.list.resume.toUpperCase()}
        </ThemedText>
        <ThemedText style={[styles.name, { color: theme.onPrimary }]} numberOfLines={2}>
          {process.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.onPrimary }} numberOfLines={2}>
          {tracking.label} · {detail}
        </ThemedText>
      </View>
      <View style={[styles.play, { backgroundColor: theme.onPrimary }]}>
        <SymbolView name={{ ios: 'play.fill', android: 'play_arrow' }} size={20} tintColor={theme.primary} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three + Spacing.half,
    borderRadius: Radius.large + 2,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -10,
    top: -6,
    opacity: 0.18,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 0.6,
    opacity: 0.85,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
