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
import { ProcessDiagram, type DiagramOverview, type FamilyStroke } from '@/components/process-diagram';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess } from '@/data/process-store';
import { longestPath, shortestPath, type PathStep, type Process, type StepKind } from '@/domain';
import { useFamilyColors, useTheme } from '@/hooks/use-theme';
import { createSimulation, type SimulationState } from '@/simulation/engine';
import { overviewOf, type PathFamily, type ProcessOverview } from '@/simulation/families';
import { layoutProcess } from '@/simulation/layout';
import { formatNumber, plural } from '@/utils/format';

type Mode = 'pas-a-pas' | 'simple' | 'complexe' | 'tous';

const MODES: { value: Mode; label: string }[] = [
  { value: 'pas-a-pas', label: 'Pas à pas' },
  { value: 'simple', label: 'Simple' },
  { value: 'complexe', label: 'Complexe' },
  { value: 'tous', label: 'Tous' },
];

const REPLAY_INTERVAL_MS = 450;

const KIND_LABELS: Record<StepKind, string> = { start: 'Départ', task: 'Étape', decision: 'Décision', end: 'Fin' };

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

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title="Process introuvable"
          message="Ce process n’existe plus sur ce téléphone."
          action={{ label: 'Revenir', onPress: () => router.back() }}
        />
      </View>
    );
  }

  return <Simulator process={process} />;
}

function Simulator({ process }: { process: Process }) {
  const theme = useTheme();
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
  const overview = useMemo(() => overviewOf(process), [process]);
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
    if (current) AccessibilityInfo.announceForAccessibility(`${KIND_LABELS[current.kind]} : ${current.title}`);
  }, [current]);

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
  const diagramHeight = Math.round(Math.min(340, Math.max(200, windowSize.height * 0.34)));

  if (state.status === 'no-start') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Simulation', headerBackTitle: 'Détail' }} />
        <StateMessage
          icon={{ ios: 'exclamationmark.triangle', android: 'warning' }}
          tone="danger"
          title="Rien à simuler"
          message="Ce process n’a pas d’étape de départ. Ajoutez-en une dans le schéma, puis importez-le à nouveau."
          action={{ label: 'Revenir au détail', onPress: () => router.back() }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Simulation',
          headerBackTitle: 'Détail',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
        }}
      />

      <View style={styles.modes} accessibilityRole="tablist">
        {MODES.map((option) => {
          const selected = option.value === mode;
          return (
            <Pressable
              key={option.value}
              onPress={() => chooseMode(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.mode,
                selected
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: theme.fieldBorder, borderWidth: 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {option.label}
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
              overview={paintOverview(overview, colorOf, isolated)}
              accessibilityLabel={`Schéma complet : ${plural(overview.families.length, 'famille')} de chemins, chacune d’une couleur${isolated ? `. Famille isolée : ${overview.families.find((family) => family.id === isolated)?.label}` : ''}.`}
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
              accessibilityLabel={`Schéma du process : ${plural(new Set(state.trail.map((item) => item.stepId)).size, 'étape affichée', 'étapes affichées')} sur ${process.steps.length}${current ? `. Étape en cours : ${current.title}` : ''}.`}
            />
          </View>

          <ScrollView
            ref={scrollRef}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: !reduceMotion })}
            contentContainerStyle={styles.content}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              {process.name} · Déroulé · {formatNumber(state.days)} JO cumulés
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
                    label && `par « ${label} »`,
                    step.actor,
                    step.duration ? plural(step.duration, 'jour ouvré', 'jours ouvrés') : null,
                    isCurrent && 'étape en cours',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  style={[styles.row, { backgroundColor: isCurrent ? theme.primaryBackground : theme.surface }]}>
                  <View style={[styles.dot, { backgroundColor: dotColor(step.kind, theme) }]} />
                  <View style={styles.flex}>
                    <ThemedText>
                      {step.title || 'Sans titre'}
                      {step.duration ? ` · ${formatNumber(step.duration)} JO` : ''}
                    </ThemedText>
                    {label && (
                      <ThemedText type="small" themeColor="textSecondary">
                        par « {label} »
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
                  {mode === 'simple' ? 'Cas simple' : 'Cas complexe'} · lecture du chemin
                </ThemedText>
                <ThemedText type="subtitle">{current.title || 'Sans titre'}</ThemedText>
              </View>
            )}

            {state.status === 'running' && current && !replaying && (
              <>
                <View style={styles.panelTitle}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: current.kind === 'decision' ? theme.warning : theme.textSecondary }}>
                    {[KIND_LABELS[current.kind], current.actor].filter(Boolean).join(' · ')}
                  </ThemedText>
                  <ThemedText type="subtitle">{current.title || 'Sans titre'}</ThemedText>
                </View>
                {choices.length === 1 ? (
                  <PrimaryButton
                    label="Étape suivante"
                    accessibilityLabel={`Étape suivante : ${sim.graph.steps.get(choices[0].to)?.title}`}
                    onPress={() => setState(sim.step(state, choices[0].id))}
                  />
                ) : (
                  <View style={styles.choices}>
                    {choices.map((link) => (
                      <View key={link.id} style={styles.choice}>
                        <PrimaryButton
                          label={link.label || sim.graph.steps.get(link.to)?.title || 'Sortie'}
                          accessibilityLabel={`Choisir ${link.label || ''} : aller à ${sim.graph.steps.get(link.to)?.title}`}
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
                  Fin atteinte
                </ThemedText>
                <ThemedText type="subtitle">
                  {plural(state.trail.length, 'étape')} · {formatNumber(state.days)} JO
                </ThemedText>
              </View>
            )}

            {state.status === 'stuck' && current && (
              <View style={styles.panelTitle}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  Impasse
                </ThemedText>
                <ThemedText type="subtitle">« {current.title} » n’a aucune sortie.</ThemedText>
              </View>
            )}

            <View style={styles.secondary}>
              {mode === 'pas-a-pas' && state.trail.length > 1 && (
                <TextButton label="Revenir en arrière" onPress={() => setState(sim.back(state))} />
              )}
              {(state.status !== 'running' || mode !== 'pas-a-pas') && (
                <TextButton label="Recommencer pas à pas" onPress={restart} />
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/** Traits du schéma « Tous » : une couleur par famille, et ce qui n'est pas dans la famille isolée est estompé. */
function paintOverview(
  overview: ProcessOverview,
  colorOf: (index: number) => string,
  isolated: string | null,
): DiagramOverview {
  const focus = overview.families.find((family) => family.id === isolated);
  const critical = new Set(
    overview.families.length > 1 && overview.critical
      ? overview.critical.steps.flatMap((step) => (step.linkId ? [step.linkId] : []))
      : [],
  );
  const strokes = new Map<string, FamilyStroke[]>();
  overview.families.forEach((family, index) => {
    if (focus && family !== focus) return;
    for (const linkId of family.links) {
      const list = strokes.get(linkId) ?? [];
      list.push({ color: colorOf(index), bold: family.critical && critical.has(linkId) });
      strokes.set(linkId, list);
    }
  });
  if (!focus) return { strokes };
  return {
    strokes,
    dimmedLinks: new Set(overview.families.flatMap((family) => [...family.links]).filter((id) => !focus.links.has(id))),
    dimmedSteps: new Set(overview.families.flatMap((family) => [...family.steps]).filter((id) => !focus.steps.has(id))),
  };
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
  const top = overview.load[0];
  if (overview.pathCount === 0) {
    return <ThemedText themeColor="textSecondary">Aucun chemin ne va du départ jusqu’à une fin.</ThemedText>;
  }
  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {process.name} · {overview.capped ? 'plus de ' : ''}
        {plural(overview.pathCount, 'chemin')} · {plural(overview.families.length, 'famille')}
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
        {overview.families.length > 1 ? 'Touchez une famille pour l’isoler sur le schéma. ' : ''}
        {overview.critical && overview.families.length > 1
          ? `Chemin critique : ${formatNumber(overview.critical.duration)} JO, en trait épais. `
          : ''}
        {top ? `Charge : ${top.actor} porte ${plural(top.steps, 'étape')} sur ${process.steps.length}.` : ''}
      </ThemedText>
      {overview.capped && (
        <ThemedText type="small" style={{ color: theme.warning }}>
          Trop de chemins pour tous les lister : seuls les {overview.pathCount} premiers sont comptés.
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
  const days =
    family.minDays === family.maxDays
      ? `${formatNumber(family.minDays)} JO`
      : `${formatNumber(family.minDays)} à ${formatNumber(family.maxDays)} JO`;
  const count = plural(family.paths.length, 'chemin');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${family.label}${family.critical ? ', critique' : ''} : ${count}, ${days.replace('JO', 'jours ouvrés')}`}
      accessibilityHint={selected ? 'Réaffiche toutes les familles' : 'Isole cette famille sur le schéma'}
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
            critique
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
