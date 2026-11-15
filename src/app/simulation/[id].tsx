import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { PrimaryButton } from '@/components/primary-button';
import { ProcessDiagram } from '@/components/process-diagram';
import { StateMessage } from '@/components/state-message';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess } from '@/data/process-store';
import { delayLevel, delayRatio, longestPath, shortestPath, slaOf, type PathStep, type Process } from '@/domain';
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
 * Simulation (refonte R9 à R11) : on rejoue le process étape par étape. Le
 * schéma montre tout le process (les étapes à venir en transparence) et suit
 * l'étape en cours (« Suivi auto ») tant qu'on ne le déplace pas au doigt. La
 * carte d'étape en bas donne le genre, les jours cumulés et les choix côte à
 * côte. « Simple » et « Complexe » rejouent le chemin le plus court et le plus
 * long ; « Tous » montre tous les chemins, une couleur par famille.
 * Plein écran : le schéma prend l'écran et la carte flotte. Téléphone tourné :
 * schéma à gauche, carte à droite.
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
  // Plein écran : le schéma prend tout l'écran, la carte d'étape flotte en bas.
  const [fullscreen, setFullscreen] = useState(false);
  // Hauteur de la zone du schéma et de la carte flottante, mesurées.
  const [areaHeight, setAreaHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  // Téléphone tourné : le schéma à gauche, la carte à droite.
  const landscape = windowSize.width > windowSize.height && windowSize.width >= 600;

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
  // Mode Délais : les jours cumulés comparés au SLA promis au client.
  const sla = slaOf(process);
  const slaLevel = sla !== undefined ? delayLevel(state.days, sla) : null;
  const slaColor = slaLevel ? { ok: theme.success, warning: theme.warning, late: theme.danger }[slaLevel] : theme.text;
  const days = (value: number) => t.format.count(value, t.words.workingDay);
  const colorOf = (index: number) => familyColors[index % familyColors.length];

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

  const tous = mode === 'tous';
  const subtitle = tous
    ? t.simulation.allSubtitle(overview.critical ? t.format.num(overview.critical.duration) : null)
    : t.simulation.subtitle(t.simulation.modes[mode], state.trail.length);
  const progress = {
    visitedSteps: new Set(state.trail.map((item) => item.stepId)),
    visitedLinks: new Set(state.trail.flatMap((item) => (item.linkId ? [item.linkId] : []))),
    currentId: current?.id,
    candidateLinks: mode === 'pas-a-pas' ? choices.map((link) => link.id) : [],
  };

  const modes = (
    <View
      style={[styles.modes, { backgroundColor: theme.surfaceMuted }, largeText && styles.modesWrap]}
      accessibilityRole="tablist"
      accessibilityLabel={t.simulation.modesLabel}>
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
              selected && [styles.modeOn, { backgroundColor: theme.surface }],
            ]}>
            <ThemedText
              type="smallBold"
              style={[styles.modeText, { color: selected ? theme.text : theme.textSecondary }]}>
              {t.simulation.modes[option]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  // La carte d'étape : genre et jours cumulés, titre, choix côte à côte, Retour et Recommencer.
  const stepCard = (
    <View style={styles.cardContent}>
      {state.status === 'running' && current && (
        <>
          <View style={styles.cardTop}>
            <View
              style={[
                styles.kindPill,
                { backgroundColor: current.kind === 'decision' ? theme.warningBackground : theme.primaryBackground },
              ]}>
              <ThemedText
                type="smallBold"
                style={[styles.kindText, { color: current.kind === 'decision' ? theme.warning : theme.link }]}>
                {replaying ? t.simulation.replaying(mode === 'simple') : t.simulation.kinds[current.kind]}
              </ThemedText>
            </View>
            <View style={styles.flex} />
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t.simulation.wd(t.format.num(state.days))}
            </ThemedText>
          </View>
          <View style={styles.cardTitle}>
            <ThemedText style={styles.stepTitle}>{current.title || t.untitled}</ThemedText>
            {(current.actor || current.duration) && (
              <ThemedText type="small" themeColor="textSecondary">
                {[current.actor, current.duration ? t.format.count(current.duration, t.words.workingDay) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            )}
          </View>
          {sla !== undefined && slaLevel && (
            <SlaBar
              label={`${t.delays.sla} · ${t.delays.simSla(t.format.num(state.days), days(sla))}`}
              accessibilityLabel={t.delays.simLabel(days(state.days), days(sla), t.delays.levels[slaLevel])}
              color={slaColor}
              ratio={delayRatio(state.days, sla)}
            />
          )}
          {!replaying &&
            (choices.length === 1 ? (
              <PrimaryButton
                label={t.simulation.next}
                accessibilityLabel={t.simulation.nextLabel(sim.graph.steps.get(choices[0].to)?.title ?? '')}
                onPress={() => setState(sim.step(state, choices[0].id))}
              />
            ) : (
              <View style={styles.choices}>
                {choices.map((link) => {
                  const target = sim.graph.steps.get(link.to)?.title ?? '';
                  return (
                    <PressableScale
                      key={link.id}
                      onPress={() => setState(sim.step(state, link.id))}
                      accessibilityRole="button"
                      accessibilityLabel={t.simulation.choose(link.label || '', target)}
                      style={[styles.choice, { backgroundColor: theme.primaryBackground, borderColor: theme.primary }]}>
                      <ThemedText style={[styles.choiceLabel, { color: theme.link }]} numberOfLines={2}>
                        {link.label || target || t.simulation.exit}
                      </ThemedText>
                      {!!link.label && (
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                          {t.simulation.to(target)}
                        </ThemedText>
                      )}
                    </PressableScale>
                  );
                })}
              </View>
            ))}
        </>
      )}

      {state.status === 'finished' && (
        <View style={[styles.result, { backgroundColor: theme.successBackground }]}>
          <SymbolView
            name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }}
            size={22}
            tintColor={theme.success}
          />
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={{ color: theme.success }}>
              {t.simulation.endReached}
            </ThemedText>
            <ThemedText style={styles.stepTitle}>
              {t.format.count(state.trail.length, t.words.step)} · {t.simulation.wd(t.format.num(state.days))}
            </ThemedText>
            {sla !== undefined && (
              <ThemedText type="smallBold" style={{ color: state.days > sla ? theme.danger : theme.success }}>
                {state.days > sla
                  ? t.delays.simMissed(days(state.days), days(state.days - sla))
                  : t.delays.simMet(t.format.num(state.days), days(sla))}
              </ThemedText>
            )}
          </View>
        </View>
      )}

      {state.status === 'stuck' && current && (
        <View style={[styles.result, { backgroundColor: theme.dangerBackground }]}>
          <SymbolView name={{ ios: 'xmark.octagon.fill', android: 'cancel' }} size={22} tintColor={theme.danger} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              {t.simulation.deadEnd}
            </ThemedText>
            <ThemedText style={styles.stepTitle}>{t.simulation.noExit(current.title)}</ThemedText>
          </View>
        </View>
      )}

      <View style={styles.secondary}>
        <TextButton
          icon={{ ios: 'arrow.uturn.backward', android: 'undo' }}
          label={t.simulation.undo}
          accessibilityLabel={t.simulation.stepBack}
          disabled={mode !== 'pas-a-pas' || state.trail.length <= 1}
          onPress={() => setState(sim.back(state))}
        />
        <TextButton
          icon={{ ios: 'arrow.counterclockwise', android: 'restart_alt' }}
          label={t.simulation.restartShort}
          accessibilityLabel={t.simulation.restart}
          onPress={restart}
        />
      </View>
    </View>
  );

  const familyList = (
    <ScrollView contentContainerStyle={styles.familyList}>
      <OverviewList
        process={process}
        overview={overview}
        colorOf={colorOf}
        isolated={isolated}
        onToggle={(familyId) => setIsolated((value) => (value === familyId ? null : familyId))}
      />
    </ScrollView>
  );

  const diagram = (height: number, extra?: { bottomInset?: number; topInset?: number }) =>
    tous ? (
      <ProcessDiagram
        key="tous"
        layout={layout}
        height={height}
        overview={paintFamilies(overview, familyColors, isolated)}
        fullscreen={fullscreen}
        onToggleFullscreen={landscape ? undefined : () => setFullscreen((value) => !value)}
        {...extra}
        accessibilityLabel={t.simulation.allLabel(
          t.format.count(overview.families.length, t.simulation.family),
          isolated ? (overview.families.find((family) => family.id === isolated)?.label ?? null) : null,
        )}
      />
    ) : (
      <ProcessDiagram
        key="parcours"
        layout={layout}
        height={height}
        progress={progress}
        fullscreen={fullscreen}
        onToggleFullscreen={landscape ? undefined : () => setFullscreen((value) => !value)}
        {...extra}
        accessibilityLabel={t.simulation.trailLabel(
          progress.visitedSteps.size,
          process.steps.length,
          current ? current.title : null,
        )}
      />
    );

  const header = (
    <Stack.Screen
      options={{
        headerShown: !fullscreen,
        title: process.name,
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <ThemedText style={styles.headerName} numberOfLines={1}>
              {process.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          </View>
        ),
        headerBackTitle: t.simulation.backTitle,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerRight: () => (
          <Pressable
            onPress={() => router.push({ pathname: '/export/[id]', params: { id: process.id } })}
            accessibilityRole="button"
            accessibilityLabel={t.simulation.export}
            hitSlop={8}
            style={[styles.headerButton, { backgroundColor: theme.surface }]}>
            <SymbolView name={{ ios: 'square.and.arrow.down', android: 'download' }} size={20} tintColor={theme.text} />
          </Pressable>
        ),
      }}
    />
  );

  // Paysage : schéma à gauche, modes et carte à droite.
  if (landscape) {
    return (
      <View style={[styles.screen, styles.row, { backgroundColor: theme.background }]}>
        {header}
        <View
          style={[
            styles.flex,
            { paddingLeft: insets.left + Spacing.three, paddingBottom: insets.bottom + Spacing.two },
          ]}
          onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}>
          {areaHeight > 0 && diagram(areaHeight - insets.bottom - Spacing.two)}
        </View>
        <ScrollView
          style={styles.side}
          contentContainerStyle={[
            styles.sideContent,
            { paddingRight: insets.right + Spacing.three, paddingBottom: insets.bottom + Spacing.three },
          ]}>
          {modes}
          {tous ? (
            <View style={styles.familyList}>
              <OverviewList
                process={process}
                overview={overview}
                colorOf={colorOf}
                isolated={isolated}
                onToggle={(familyId) => setIsolated((value) => (value === familyId ? null : familyId))}
              />
            </View>
          ) : (
            <View style={[styles.card, styles.cardSide, { backgroundColor: theme.surface }]}>{stepCard}</View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Plein écran : le schéma sous la barre d'état, la carte flottante en bas.
  if (fullscreen) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        {header}
        {diagram(windowSize.height, { topInset: insets.top, bottomInset: cardHeight + insets.bottom + Spacing.three })}
        <View
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          style={[
            styles.card,
            styles.floating,
            tous && styles.floatingList,
            { backgroundColor: theme.surface, bottom: insets.bottom + Spacing.three },
          ]}>
          {tous ? familyList : stepCard}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {header}
      <View style={styles.padded}>{modes}</View>
      <View style={[styles.flex, styles.padded]} onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}>
        {areaHeight > 0 && diagram(areaHeight)}
      </View>
      <View
        style={[
          styles.card,
          styles.docked,
          tous && styles.dockedList,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        {tous ? familyList : stepCard}
      </View>
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

function TextButton({
  icon,
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = disabled ? theme.textSecondary : theme.link;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.textButton, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}>
      <SymbolView name={icon} size={16} tintColor={color} />
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** La barre du SLA dans la carte d'étape : jours cumulés sur le SLA, en vert, orange puis rouge. */
function SlaBar({
  label,
  accessibilityLabel,
  color,
  ratio,
}: {
  label: string;
  accessibilityLabel: string;
  color: string;
  ratio: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sla} accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.slaHead}>
        <SymbolView name={{ ios: 'timer', android: 'timer' }} size={14} tintColor={color} />
        <ThemedText type="smallBold" style={{ color }}>
          {label}
        </ThemedText>
      </View>
      <View style={[styles.slaTrack, { backgroundColor: theme.surfaceMuted }]}>
        <View style={[styles.slaFill, { backgroundColor: color, width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sla: { gap: Spacing.one },
  slaHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  slaTrack: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  slaFill: { height: '100%', borderRadius: Radius.pill },
  screen: { flex: 1 },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  padded: {
    paddingHorizontal: Spacing.three - Spacing.one,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  headerTitle: { alignItems: 'center', maxWidth: 220 },
  headerName: { fontSize: 16, lineHeight: 20, fontWeight: 800 },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modes: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    marginBottom: Spacing.three - Spacing.half * 3,
    borderRadius: Radius.medium,
  },
  mode: { flex: 1, minHeight: 40, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  modeOn: { boxShadow: '0 2px 8px rgba(14, 27, 44, 0.12)' },
  modeText: { fontWeight: 700 },
  // Grands textes : les quatre modes sur deux lignes.
  modesWrap: { flexWrap: 'wrap' },
  modeWide: { flex: 0, flexGrow: 1, flexBasis: '45%' },
  card: { borderRadius: Radius.sheet - 2 },
  docked: {
    marginTop: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.four - Spacing.half * 2,
    paddingTop: Spacing.three + Spacing.half,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: '0 -8px 24px rgba(14, 27, 44, 0.10)',
  },
  dockedList: { maxHeight: '45%' },
  floating: {
    position: 'absolute',
    left: Spacing.three - Spacing.one,
    right: Spacing.three - Spacing.one,
    padding: Spacing.three + Spacing.half,
    boxShadow: '0 12px 32px rgba(14, 27, 44, 0.25)',
  },
  floatingList: { maxHeight: '40%' },
  side: { width: 360, flexGrow: 0 },
  sideContent: { paddingLeft: Spacing.three, gap: Spacing.three - Spacing.one },
  cardSide: { padding: Spacing.three + Spacing.half },
  cardContent: { gap: Spacing.three - Spacing.one, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kindPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.half,
  },
  kindText: { fontSize: 12, lineHeight: 18, fontWeight: 800 },
  cardTitle: { gap: Spacing.half },
  stepTitle: { fontSize: 19, lineHeight: 25, fontWeight: 800 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 64,
    justifyContent: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
  },
  choiceLabel: { fontSize: 16, lineHeight: 21, fontWeight: 800 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radius.medium,
  },
  secondary: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  textButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.one,
  },
  familyList: { gap: Spacing.two, paddingBottom: Spacing.two },
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
});
