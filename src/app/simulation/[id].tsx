import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ProcessDiagram } from '@/components/process-diagram';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess } from '@/data/process-store';
import { longestPath, shortestPath, type PathStep, type Process, type StepKind } from '@/domain';
import { useLargeText } from '@/hooks/use-large-text';
import { useFamilyColors, useTheme } from '@/hooks/use-theme';
import { createSimulation, type SimulationState } from '@/simulation/engine';
import { overviewOf, paintFamilies, type PathFamily, type ProcessOverview } from '@/simulation/families';
import { layoutProcess } from '@/simulation/layout';
import { useT } from '@/i18n';

type Mode = 'pas-a-pas' | 'simple' | 'complexe' | 'tous';

const MODES: Mode[] = ['pas-a-pas', 'simple', 'complexe', 'tous'];

const REPLAY_INTERVAL_MS = 450;

/**
 * Simulation (maquette, écran 4) : on rejoue le process étape par étape. À
 * chaque décision, on choisit la sortie ; « Simple » et « Complexe » rejouent
 * le chemin le plus court et le plus long. « Tous » (maquette, écran 11) montre
 * tous les chemins à la fois, une couleur par famille.
 */
export default function SimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const process = getProcess(id);
  const theme = useTheme();
  const t = useT();

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title={t.detail.notFound}
          message={t.simulation.notFoundText}
          action={{ label: t.simulation.back, onPress: () => router.back() }}
        />
      </View>
    );
  }

  return <Simulator process={process} />;
}

function Simulator({ process }: { process: Process }) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sim = useMemo(() => createSimulation(process), [process]);
  const [mode, setMode] = useState<Mode>('pas-a-pas');
  const layout = useMemo(() => layoutProcess(process), [process]);
  const [state, setState] = useState<SimulationState>(() => sim.start());
  // Cas simple et cas complexe : le chemin est rejoué étape par étape, pour
  // voir le schéma se construire.
  const [replayTarget, setReplayTarget] = useState<PathStep[] | null>(null);
  const windowSize = useWindowDimensions();
  const largeText = useLargeText();
  // Les noms des familles sont dans la langue de l'app : recalculés quand elle change.
  const overview = useMemo(() => overviewOf(process, t), [process, t]);
  const familyColors = useFamilyColors();
  // Famille isolée sur le schéma (vue « Tous »).
  const [isolated, setIsolated] = useState<string | null>(null);

  const current = sim.current(state);
  const choices = sim.choices(state);
  const replaying = replayTarget !== null && state.trail.length < replayTarget.length;

  useEffect(() => {
    if (!replayTarget) return;
    let shown = 1;
    const timer = setInterval(() => {
      shown += 1;
      setState(sim.replay(replayTarget.slice(0, shown)));
      if (shown >= replayTarget.length) clearInterval(timer);
    }, REPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [replayTarget, sim]);

  // Le lecteur d'écran annonce chaque nouvelle étape.
  useEffect(() => {
    if (current)
      AccessibilityInfo.announceForAccessibility(
        t.simulation.announce(t.simulation.kinds[current.kind], current.title),
      );
  }, [current, t]);

  const chooseMode = (next: Mode) => {
    setMode(next);
    setReplayTarget(null);
    setIsolated(null);
    if (next === 'pas-a-pas' || next === 'tous') return setState(sim.start());
    const path = next === 'simple' ? shortestPath(process) : longestPath(process);
    if (!path) return setState(sim.start());
    // Sans animation, le chemin s'affiche d'un coup.
    setState(sim.replay(reduceMotion ? path.steps : path.steps.slice(0, 1)));
    if (!reduceMotion) setReplayTarget(path.steps);
  };

  const restart = () => chooseMode('pas-a-pas');
  const colorOf = (index: number) => familyColors[index % familyColors.length];
  // Grands textes : schéma plus bas, pour laisser la place au texte de l'étape.
  const diagramHeight = Math.round(Math.min(340, Math.max(200, windowSize.height * (largeText ? 0.26 : 0.34))));

  if (state.status === 'no-start') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: t.titles.simulation, headerBackTitle: t.simulation.backTitle }} />
        <StateMessage
          icon={{ ios: 'exclamationmark.triangle', android: 'warning' }}
          tone="danger"
          title={t.simulation.nothingTitle}
          message={t.simulation.nothingText}
          action={{ label: t.simulation.backToDetail, onPress: () => router.back() }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.simulation,
          headerBackTitle: t.simulation.backTitle,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/export/[id]', params: { id: process.id } })}
              accessibilityRole="button"
              accessibilityLabel={t.simulation.export}
              hitSlop={12}
              style={styles.headerButton}>
              <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share' }} size={22} tintColor={theme.link} />
            </Pressable>
          ),
        }}
      />

      <View style={[styles.modes, largeText && styles.modesWrap]} accessibilityRole="tablist">
        {MODES.map((option) => {
          const selected = option === mode;
          return (
            <Pressable
              key={option}
              onPress={() => chooseMode(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.mode,
                largeText && styles.modeWide,
                selected
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: theme.fieldBorder, borderWidth: 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {t.simulation.modes[option]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {mode === 'tous' ? (
        <>
          <View style={styles.diagram}>
            <ProcessDiagram
              key="tous"
              layout={layout}
              height={Math.round(Math.min(480, Math.max(240, windowSize.height * 0.5)))}
              overview={paintFamilies(overview, familyColors, isolated)}
              accessibilityLabel={t.simulation.allLabel(
                t.format.count(overview.families.length, t.simulation.family),
                isolated ? (overview.families.find((family) => family.id === isolated)?.label ?? null) : null,
              )}
            />
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
            <OverviewList
              process={process}
              overview={overview}
              colorOf={colorOf}
              isolated={isolated}
              onToggle={(familyId) => setIsolated((value) => (value === familyId ? null : familyId))}
            />
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.diagram}>
            <ProcessDiagram
              key="parcours"
              layout={layout}
              height={diagramHeight}
              progress={{
                visitedSteps: new Set(state.trail.map((item) => item.stepId)),
                visitedLinks: new Set(state.trail.flatMap((item) => (item.linkId ? [item.linkId] : []))),
                currentId: current?.id,
                candidateLinks: mode === 'pas-a-pas' ? choices.map((link) => link.id) : [],
              }}
              accessibilityLabel={t.simulation.trailLabel(
                new Set(state.trail.map((item) => item.stepId)).size,
                process.steps.length,
                current ? current.title : null,
              )}
            />
          </View>

          <ScrollView
            ref={scrollRef}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: !reduceMotion })}
            contentContainerStyle={styles.content}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              {t.simulation.trailTitle(process.name, t.format.num(state.days))}
            </ThemedText>
            {state.trail.map(({ stepId, linkId }, index) => {
              const step = sim.graph.steps.get(stepId)!;
              const label = linkId ? process.links.find((link) => link.id === linkId)?.label : undefined;
              const isCurrent = index === state.trail.length - 1;
              return (
                <Animated.View
                  key={`${index}-${stepId}`}
                  entering={reduceMotion ? undefined : FadeInDown.duration(250)}
                  accessible
                  accessibilityLabel={[
                    `${index + 1}. ${step.title}`,
                    label && t.simulation.via(label),
                    step.actor,
                    step.duration ? t.format.count(step.duration, t.words.workingDay) : null,
                    isCurrent && t.simulation.currentStep,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  style={[styles.row, { backgroundColor: isCurrent ? theme.primaryBackground : theme.surface }]}>
                  <View style={[styles.dot, { backgroundColor: dotColor(step.kind, theme) }]} />
                  <View style={styles.flex}>
                    <ThemedText>
                      {step.title || t.untitled}
                      {step.duration ? ` · ${t.simulation.wd(t.format.num(step.duration))}` : ''}
                    </ThemedText>
                    {label && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t.simulation.via(label)}
                      </ThemedText>
                    )}
                  </View>
                  {step.actor && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {step.actor}
                    </ThemedText>
                  )}
                </Animated.View>
              );
            })}
          </ScrollView>

          <View
            style={[
              styles.panel,
              { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.three, shadowColor: theme.text },
            ]}>
            {state.status === 'running' && current && replaying && (
              <View style={styles.panelTitle}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t.simulation.replaying(mode === 'simple')}
                </ThemedText>
                <ThemedText type="subtitle">{current.title || t.untitled}</ThemedText>
              </View>
            )}

            {state.status === 'running' && current && !replaying && (
              <>
                <View style={styles.panelTitle}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: current.kind === 'decision' ? theme.warning : theme.textSecondary }}>
                    {[t.simulation.kinds[current.kind], current.actor].filter(Boolean).join(' · ')}
                  </ThemedText>
                  <ThemedText type="subtitle">{current.title || t.untitled}</ThemedText>
                </View>
                {choices.length === 1 ? (
                  <PrimaryButton
                    label={t.simulation.next}
                    accessibilityLabel={t.simulation.nextLabel(sim.graph.steps.get(choices[0].to)?.title ?? '')}
                    onPress={() => setState(sim.step(state, choices[0].id))}
                  />
                ) : (
                  <View style={styles.choices}>
                    {choices.map((link) => (
                      <View key={link.id} style={styles.choice}>
                        <PrimaryButton
                          label={link.label || sim.graph.steps.get(link.to)?.title || t.simulation.exit}
                          accessibilityLabel={t.simulation.choose(
                            link.label || '',
                            sim.graph.steps.get(link.to)?.title ?? '',
                          )}
                          onPress={() => setState(sim.step(state, link.id))}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {state.status === 'finished' && (
              <View style={styles.panelTitle}>
                <ThemedText type="smallBold" style={{ color: theme.success }}>
                  {t.simulation.endReached}
                </ThemedText>
                <ThemedText type="subtitle">
                  {t.format.count(state.trail.length, t.words.step)} · {t.simulation.wd(t.format.num(state.days))}
                </ThemedText>
              </View>
            )}

            {state.status === 'stuck' && current && (
              <View style={styles.panelTitle}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  {t.simulation.deadEnd}
                </ThemedText>
                <ThemedText type="subtitle">{t.simulation.noExit(current.title)}</ThemedText>
              </View>
            )}

            <View style={styles.secondary}>
              {mode === 'pas-a-pas' && state.trail.length > 1 && (
                <TextButton label={t.simulation.stepBack} onPress={() => setState(sim.back(state))} />
              )}
              {(state.status !== 'running' || mode !== 'pas-a-pas') && (
                <TextButton label={t.simulation.restart} onPress={restart} />
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function OverviewList({
  process,
  overview,
  colorOf,
  isolated,
  onToggle,
}: {
  process: Process;
  overview: ProcessOverview;
  colorOf: (index: number) => string;
  isolated: string | null;
  onToggle: (familyId: string) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const s = t.simulation;
  const top = overview.load[0];
  if (overview.pathCount === 0) {
    return <ThemedText themeColor="textSecondary">{s.noPath}</ThemedText>;
  }
  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {s.overviewTitle(
          process.name,
          overview.capped,
          t.format.count(overview.pathCount, t.words.path),
          t.format.count(overview.families.length, s.family),
        )}
      </ThemedText>
      {overview.families.map((family, index) => (
        <FamilyRow
          key={family.id}
          family={family}
          color={colorOf(index)}
          selected={family.id === isolated}
          onPress={() => onToggle(family.id)}
        />
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        {overview.families.length > 1 ? s.isolateHint : ''}
        {overview.critical && overview.families.length > 1 ? s.critical(t.format.num(overview.critical.duration)) : ''}
        {top ? s.load(top.actor, t.format.count(top.steps, t.words.step), process.steps.length) : ''}
      </ThemedText>
      {overview.capped && (
        <ThemedText type="small" style={{ color: theme.warning }}>
          {s.capped(overview.pathCount)}
        </ThemedText>
      )}
    </>
  );
}

function FamilyRow({
  family,
  color,
  selected,
  onPress,
}: {
  family: PathFamily;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const s = t.simulation;
  const days =
    family.minDays === family.maxDays
      ? s.wd(t.format.num(family.minDays))
      : s.daysRange(t.format.num(family.minDays), t.format.num(family.maxDays));
  const count = t.format.count(family.paths.length, t.words.path);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={s.familyLabel(family.label, family.critical, count, days)}
      accessibilityHint={selected ? s.showAllFamilies : s.isolateFamily}
      style={({ pressed }) => [
        styles.family,
        {
          backgroundColor: selected || pressed ? theme.primaryBackground : theme.surface,
          borderColor: family.critical ? theme.warning : selected ? color : 'transparent',
        },
      ]}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <View style={styles.familyLabel}>
        <ThemedText style={styles.shrink}>{family.label}</ThemedText>
        {family.critical && (
          <ThemedText
            type="smallBold"
            style={[styles.badge, { color: theme.warning, backgroundColor: theme.warningBackground }]}>
            {s.criticalBadge}
          </ThemedText>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {count} · {days}
      </ThemedText>
    </Pressable>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.textButton}>
      <ThemedText type="smallBold" style={{ color: theme.link }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function dotColor(kind: StepKind, theme: ReturnType<typeof useTheme>) {
  if (kind === 'start') return theme.text;
  if (kind === 'decision') return theme.warning;
  if (kind === 'end') return theme.success;
  return theme.primary;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  diagram: {
    paddingHorizontal: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  modes: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  mode: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Grands textes : les quatre modes sur deux lignes.
  modesWrap: { flexWrap: 'wrap' },
  modeWide: { flex: 0, flexGrow: 1, flexBasis: '45%' },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.small,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  family: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 2,
  },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  familyLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  shrink: { flexShrink: 1 },
  badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, overflow: 'hidden' },
  panel: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  panelTitle: { gap: Spacing.half },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { flexGrow: 1, flexBasis: '45%' },
  secondary: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.three },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
});
