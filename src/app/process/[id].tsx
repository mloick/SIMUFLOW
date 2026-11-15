import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/backend/auth';
import { Accordion } from '@/components/accordion';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Badge } from '@/components/badge';
import { PressableScale } from '@/components/pressable-scale';
import { StateMessage } from '@/components/state-message';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { ValidationCard } from '@/components/validation-card';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  getProcess,
  isImported,
  isInCloud,
  removeImportedProcess,
  useCloudId,
  useImportedProcesses,
} from '@/data/process-store';
import { useShared } from '@/data/shared-store';
import { saveTracking, useTrackings } from '@/data/tracking-store';
import { countPaths, explainIssue, summarize, type Issue, type Process } from '@/domain';
import { useLargeText } from '@/hooks/use-large-text';
import { useTheme } from '@/hooks/use-theme';
import { formatMoment, timingBadge } from '@/tracking/format';
import { currentStep, startTracking } from '@/tracking/tracking';
import { confirmAction } from '@/utils/confirm';
import { useT, type Messages } from '@/i18n';

/**
 * Détail d'un process (refonte R8) : source, chiffres en tuiles, gros bouton
 * « Lancer la simulation », 4 actions rondes, puis des sections qui se
 * déplient (diagnostic, acteurs, étapes, partage, suivi), chacune avec son
 * « ? ». Le menu « … » regroupe export, résumé, modification et suppression.
 * « Voir » déplie les étapes et fait défiler jusqu'à celle concernée.
 */
export default function ProcessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useImportedProcesses(); // relit le process après une modification
  const process = getProcess(id);
  const theme = useTheme();
  const t = useT();

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title={t.detail.notFound}
          message={t.detail.notFoundText}
          action={{ label: t.detail.backToList, onPress: () => router.back() }}
        />
      </View>
    );
  }

  return <ProcessDetail process={process} />;
}

function ProcessDetail({ process }: { process: Process }) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const stepY = useRef(new Map<string, number>());
  // Position de la liste des étapes dans la page : celle de sa section plus son décalage dans la section.
  const sectionY = useRef(0);
  const listY = useRef(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const shared = useShared(process.id);
  const cloudId = useCloudId(process.id);
  const session = useSession();
  const trackings = useTrackings(process.id);
  const imported = isImported(process.id);

  const summary = useMemo(() => summarize(process), [process]);
  const paths = useMemo(() => countPaths(process), [process]);
  const toFix = summary.errorCount + summary.warningCount;
  const shown = summary.issues.filter((issue) => issue.severity !== 'info');
  const folded = summary.issues.filter((issue) => issue.severity === 'info');
  const fixTone = summary.errorCount > 0 ? 'danger' : summary.warningCount > 0 ? 'warning' : 'success';
  const ongoing = trackings.filter((tracking) => !tracking.finishedAt).length;

  // « Voir » : déplie les étapes, puis fait défiler jusqu'à celle concernée une fois la liste affichée.
  const showStep = (stepId: string) => {
    setStepsOpen(true);
    setHighlighted(stepId);
    setTimeout(() => {
      const y = stepY.current.get(stepId);
      if (y !== undefined)
        scrollRef.current?.scrollTo({ y: sectionY.current + listY.current + y - Spacing.four, animated: true });
    }, 120);
  };

  const share = () =>
    Share.share({
      message: t.detail.shareMessage(process.name, t.format.count(summary.stepCount, t.words.step), toFix),
    });
  const openExport = () => router.push({ pathname: '/export/[id]', params: { id: process.id } });
  const openEdit = () => router.push({ pathname: '/process/modifier/[id]', params: { id: process.id } });
  const openSharing = () => router.push({ pathname: '/partage/[id]', params: { id: process.id } });
  const openMyPart = () => router.push({ pathname: '/ma-partie/[id]', params: { id: process.id } });
  const track = () => {
    const id = startNewTracking(t, process);
    if (id) router.push({ pathname: '/suivi/[id]', params: { id } });
  };

  const confirmDelete = () =>
    confirmAction(
      t.detail.deleteTitle,
      isInCloud(process.id) ? t.detail.deleteCloud(process.name) : t.detail.deleteLocal(process.name),
      t.detail.delete,
      () => {
        removeImportedProcess(process.id);
        router.back();
      },
      t.common.cancel,
    );

  // Les 4 actions rondes : Modifier (ou Ma partie pour un process partagé avec moi), Exporter, Partager, Suivre.
  const quick = (
    [
      imported
        ? {
            label: t.detail.quick.edit,
            icon: { ios: 'pencil', android: 'edit' },
            onPress: openEdit,
            hint: t.detail.editHint,
          }
        : shared
          ? {
              label: t.detail.quick.myPart,
              icon: { ios: 'checkmark.circle', android: 'task_alt' },
              onPress: openMyPart,
            }
          : null,
      {
        label: t.detail.quick.export,
        icon: { ios: 'square.and.arrow.down', android: 'download' },
        onPress: openExport,
      },
      imported
        ? { label: t.detail.quick.share, icon: { ios: 'person.2', android: 'group' }, onPress: openSharing }
        : { label: t.detail.quick.share, icon: { ios: 'square.and.arrow.up', android: 'share' }, onPress: share },
      { label: t.detail.quick.track, icon: { ios: 'clock', android: 'schedule' }, onPress: track },
    ] as (QuickActionProps | null)[]
  ).filter((action): action is QuickActionProps => action !== null);

  const menu: SheetAction[] = [
    { label: t.detail.exportAll, icon: { ios: 'square.and.arrow.down', android: 'download' }, onPress: openExport },
    { label: t.detail.sendSummary, icon: { ios: 'text.alignleft', android: 'notes' }, onPress: share },
    ...(imported
      ? [
          { label: t.detail.edit, icon: { ios: 'pencil', android: 'edit' }, onPress: openEdit } as SheetAction,
          {
            label: t.detail.deleteProcess,
            icon: { ios: 'trash', android: 'delete' },
            onPress: confirmDelete,
            destructive: true,
          } as SheetAction,
        ]
      : []),
  ];

  const sourceLine = [
    process.source ? t.sources[process.source] : null,
    process.editedAt
      ? t.detail.edited(
          new Date(process.editedAt).toLocaleDateString(t.common.locale, { day: 'numeric', month: 'short' }),
        )
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const maxActorSteps = Math.max(
    1,
    ...summary.actors.map((actor) => process.steps.filter((s) => s.actor === actor).length),
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerBackTitle: t.detail.back,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerRight: () => (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t.detail.more}
              hitSlop={8}
              style={[styles.more, { backgroundColor: theme.surface }]}>
              <SymbolView name={{ ios: 'ellipsis', android: 'more_horiz' }} size={20} tintColor={theme.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.titleBlock}>
          {sourceLine !== '' && (
            <View style={styles.pill}>
              <Badge label={sourceLine} tone="primary" />
            </View>
          )}
          <ThemedText type="title" accessibilityRole="header" style={styles.title}>
            {process.name}
          </ThemedText>
          {shared && (
            <ThemedText themeColor="textSecondary">{t.detail.sharedBy(shared.ownerName, shared.actor)}</ThemedText>
          )}
        </View>

        <View style={styles.stats}>
          <StatTile value={summary.stepCount} label={t.detail.stats.steps(summary.stepCount)} />
          <StatTile value={paths.capped ? `${paths.count}+` : paths.count} label={t.detail.stats.paths(paths.count)} />
          <StatTile value={toFix} label={t.detail.stats.toFix(toFix)} tone={fixTone} />
        </View>

        <PressableScale
          onPress={() => router.push({ pathname: '/simulation/[id]', params: { id: process.id } })}
          accessibilityRole="button"
          accessibilityLabel={t.detail.simulateLabel}
          style={[styles.simulate, { backgroundColor: theme.primary }]}>
          <SymbolView name={{ ios: 'play.fill', android: 'play_arrow' }} size={20} tintColor={theme.onPrimary} />
          <ThemedText style={[styles.simulateText, { color: theme.onPrimary }]}>{t.detail.simulate}</ThemedText>
        </PressableScale>

        <View style={styles.quick}>
          {quick.map((action) => (
            <QuickAction key={action.label} {...action} />
          ))}
        </View>

        <Accordion
          icon={
            toFix > 0
              ? { ios: 'exclamationmark.triangle', android: 'warning' }
              : { ios: 'checkmark.seal', android: 'verified' }
          }
          title={t.detail.diagnostic}
          summary={t.detail.points(toFix)}
          tone={fixTone}
          help={t.detail.help.diagnostic}
          initiallyOpen={toFix > 0}>
          <DiagnosticList process={process} shown={shown} folded={folded} onShow={showStep} />
        </Accordion>

        {summary.actors.length > 0 && (
          <Accordion
            icon={{ ios: 'person.3', android: 'groups' }}
            title={t.detail.actors}
            summary={String(summary.actors.length)}
            help={t.detail.help.actors}>
            {summary.actors.map((actor, index) => {
              const count = process.steps.filter((step) => step.actor === actor).length;
              const color = [theme.primary, theme.accent, theme.warning, theme.textSecondary][index % 4];
              return (
                <View key={actor} style={[styles.line, { borderTopColor: theme.border }]} accessible>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{t.detail.actorSteps(actor, count)}</ThemedText>
                    <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
                      <View
                        style={[styles.barFill, { backgroundColor: color, width: `${(count / maxActorSteps) * 100}%` }]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </Accordion>
        )}

        <View onLayout={(e) => (sectionY.current = e.nativeEvent.layout.y)}>
          <Accordion
            icon={{ ios: 'list.bullet', android: 'format_list_bulleted' }}
            title={t.detail.steps}
            summary={String(process.steps.length)}
            help={t.detail.help.steps}
            open={stepsOpen}
            onToggle={setStepsOpen}>
            <View onLayout={(e) => (listY.current = e.nativeEvent.layout.y + 60)}>
              {process.steps.map((step, index) => (
                <View
                  key={step.id}
                  onLayout={(e) => stepY.current.set(step.id, e.nativeEvent.layout.y)}
                  accessible
                  style={[
                    styles.step,
                    { borderTopColor: theme.border },
                    highlighted === step.id && { backgroundColor: theme.primaryBackground },
                  ]}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.stepNumber}>
                    {index + 1}
                  </ThemedText>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{step.title || t.untitled}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[t.kinds[step.kind], step.actor].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  {!!step.duration && (
                    <ThemedText type="smallBold" style={{ color: theme.link }}>
                      {t.format.count(step.duration, t.words.workingDay)}
                    </ThemedText>
                  )}
                </View>
              ))}
            </View>
          </Accordion>
        </View>

        {imported && (
          <Accordion
            icon={{ ios: 'person.2', android: 'group' }}
            title={t.detail.sharing}
            tone="success"
            help={t.detail.help.sharing}>
            <View style={styles.inner}>
              {session && cloudId && <ValidationCard process={process} cloudId={cloudId} />}
              <SoftButton label={t.detail.shareWithActors} onPress={openSharing} />
            </View>
          </Accordion>
        )}

        {shared && (
          <Accordion
            icon={{ ios: 'checkmark.circle', android: 'task_alt' }}
            title={t.detail.myPart}
            help={t.detail.help.myPart}
            initiallyOpen>
            <View style={styles.inner}>
              <ThemedText type="small" themeColor="textSecondary">
                {t.detail.reviewMyPartHint(shared.ownerName)}
              </ThemedText>
              <SoftButton label={t.detail.reviewMyPart} onPress={openMyPart} />
            </View>
          </Accordion>
        )}

        <Accordion
          icon={{ ios: 'clock', android: 'schedule' }}
          title={t.detail.tracking}
          summary={t.detail.inProgress(ongoing)}
          help={t.detail.help.tracking}>
          <TrackingList process={process} onStart={track} />
        </Accordion>
      </ScrollView>

      <ActionSheet visible={menuOpen} title={t.detail.actionsTitle} actions={menu} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

type QuickActionProps = {
  label: string;
  icon: SymbolViewProps['name'];
  onPress: () => void;
  hint?: string;
};

/** Action ronde sous « Lancer la simulation » : une tuile d'icône et son nom. */
function QuickAction({ label, icon, onPress, hint }: QuickActionProps) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.quickItem}>
      <View style={[styles.quickIcon, { backgroundColor: theme.surface }]}>
        <SymbolView name={icon} size={22} tintColor={theme.link} />
      </View>
      <ThemedText type="smallBold" style={styles.quickLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </PressableScale>
  );
}

/** Bouton doux en bas d'une section (« Inviter un acteur », « Suivre une demande »). */
function SoftButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.soft, { backgroundColor: theme.primaryBackground }]}>
      <ThemedText type="link" style={[styles.softText, { color: theme.link }]}>
        {label}
      </ThemedText>
    </PressableScale>
  );
}

/** Commence le suivi d'une demande réelle de ce process et renvoie son identifiant. */
function startNewTracking(t: Messages, process: Process): string | null {
  const now = new Date();
  const label = t.detail.newTrackingLabel(t.dates.short(now));
  const tracking = startTracking(process, now, `suivi-${now.getTime()}`, label);
  if (!tracking) return null;
  saveTracking(tracking);
  return tracking.id;
}

/** Les demandes réelles suivies pour ce process, et « Suivre une demande ». */
function TrackingList({ process, onStart }: { process: Process; onStart: () => void }) {
  const theme = useTheme();
  const t = useT();
  const trackings = useTrackings(process.id);
  const [now] = useState(() => new Date());
  const open = (id: string) => router.push({ pathname: '/suivi/[id]', params: { id } });

  return (
    <View style={styles.inner}>
      {trackings.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {t.detail.trackingIntro}
        </ThemedText>
      )}
      {trackings.map((tracking) => {
        const current = currentStep(tracking);
        const title = current && process.steps.find((step) => step.id === current.stepId)?.title;
        return (
          <Pressable
            key={tracking.id}
            onPress={() => open(tracking.id)}
            accessibilityRole="button"
            style={[styles.trackingRow, { borderBottomColor: theme.border }]}>
            <View style={[styles.flex, styles.trackingText]}>
              <ThemedText type="smallBold">{tracking.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {current
                  ? t.detail.currentDue(title || t.untitled, current.dueAt ? formatMoment(current.dueAt, t) : null)
                  : t.detail.finishedOn(formatMoment(tracking.finishedAt!, t))}
              </ThemedText>
              {current && <Badge {...timingBadge(current, now, t)} />}
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right' }}
              size={16}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        );
      })}
      <SoftButton label={t.detail.startTracking} onPress={onStart} />
    </View>
  );
}

function StatTile({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const theme = useTheme();
  const largeText = useLargeText();
  const color = tone ? theme[tone] : theme.text;
  const background = tone ? theme[`${tone}Background`] : theme.surface;

  return (
    <View style={[styles.tile, largeText && styles.tileWide, { backgroundColor: background }]} accessible>
      <ThemedText style={[styles.tileValue, { color }]}>{value}</ThemedText>
      <ThemedText type="small" style={{ color: tone ? color : theme.textSecondary }}>
        {label}
      </ThemedText>
    </View>
  );
}

function DiagnosticList({
  process,
  shown,
  folded,
  onShow,
}: {
  process: Process;
  shown: Issue[];
  folded: Issue[];
  onShow: (stepId: string) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const visible = open ? [...shown, ...folded] : shown;

  return (
    <View>
      {shown.length === 0 && (
        <View style={styles.issue}>
          <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle' }} size={22} tintColor={theme.success} />
          <ThemedText style={[styles.issueText, { color: theme.success }]}>{t.detail.noIssue}</ThemedText>
        </View>
      )}
      {visible.map((issue, index) => {
        const { title, detail } = explainIssue(issue, process, t);
        const color =
          issue.severity === 'error'
            ? theme.danger
            : issue.severity === 'warning'
              ? theme.warning
              : theme.textSecondary;
        const icon =
          issue.severity === 'error'
            ? ({ ios: 'xmark.octagon', android: 'cancel' } as const)
            : issue.severity === 'warning'
              ? ({ ios: 'exclamationmark.triangle', android: 'warning' } as const)
              : ({ ios: 'info.circle', android: 'info' } as const);
        const stepId = issue.stepId;
        return (
          <View
            key={`${issue.code}-${issue.stepId ?? issue.linkId ?? index}`}
            style={[styles.issue, (index > 0 || shown.length === 0) && { borderTopColor: theme.border }]}>
            <SymbolView name={icon} size={22} tintColor={color} />
            <View style={styles.issueText} accessible>
              <ThemedText type="smallBold">{title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {detail}
              </ThemedText>
            </View>
            {stepId && (
              <Pressable
                onPress={() => onShow(stepId)}
                accessibilityRole="button"
                accessibilityLabel={t.detail.seeStep(title)}
                hitSlop={8}
                style={styles.see}>
                <ThemedText type="link">{t.detail.see}</ThemedText>
              </Pressable>
            )}
          </View>
        );
      })}
      {folded.length > 0 && (
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={[styles.fold, { borderTopColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.issueText}>
            {open ? t.detail.foldInfo : t.detail.foldedInfo(folded.length)}
          </ThemedText>
          <SymbolView
            name={
              open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }
            }
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, gap: Spacing.half },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { gap: Spacing.two },
  pill: { flexDirection: 'row' },
  title: { fontWeight: 800, letterSpacing: -0.8, fontSize: 30, lineHeight: 36 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three - Spacing.half * 3 },
  tile: {
    flexGrow: 1,
    flexBasis: '28%',
    padding: Spacing.three - Spacing.half,
    borderRadius: Radius.medium + 2,
  },
  tileValue: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  // Grands textes : une case par ligne, pour ne pas couper les mots.
  tileWide: { flexBasis: '100%' },
  simulate: {
    minHeight: 58,
    borderRadius: Radius.medium + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three - Spacing.half * 3,
    paddingHorizontal: Spacing.three,
  },
  simulateText: { fontSize: 17, fontWeight: 800 },
  quick: { flexDirection: 'row', gap: Spacing.two },
  quickItem: { flex: 1, alignItems: 'center', gap: Spacing.one + Spacing.half, paddingVertical: Spacing.one },
  quickIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
  inner: { gap: Spacing.three - Spacing.one, paddingTop: Spacing.three - Spacing.one },
  soft: {
    minHeight: 46,
    borderRadius: Radius.small + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  softText: { fontWeight: 800, textAlign: 'center' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.half * 3,
    minHeight: 48,
    paddingTop: Spacing.three - Spacing.half * 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three - Spacing.half * 3,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  trackingText: { alignItems: 'flex-start' },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingBottom: Spacing.three - Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  issue: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three - Spacing.one,
    paddingVertical: Spacing.three - Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  issueText: { flex: 1, gap: Spacing.half },
  see: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingVertical: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
  },
  stepNumber: { width: 22 },
});
