import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/badge';
import { DelayMeter } from '@/components/delay-meter';
import { PrimaryButton } from '@/components/primary-button';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { fontFaceFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess, useImportedProcesses } from '@/data/process-store';
import { removeTracking, saveTracking, useTrackings } from '@/data/tracking-store';
import type { Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { workingDaysBetween } from '@/tracking/calendar';
import { delayReport, olaClock, slaClock, splitWorkingTime, type DelayClock } from '@/tracking/delays';
import { formatMoment, timingBadge } from '@/tracking/format';
import {
  completeStep,
  currentStep,
  currentSteps,
  nextChoices,
  stepOf,
  waitingSteps,
  type TrackedStep,
  type Tracking,
} from '@/tracking/tracking';
import { confirmAction } from '@/utils/confirm';
import { useT, type Messages } from '@/i18n';

/**
 * Suivi d'une demande réelle : l'étape en cours avec son échéance (jours
 * ouvrés), le bouton pour la terminer (ou choisir la branche à une décision),
 * puis l'historique des étapes passées.
 *
 * Refonte R14 : grande carte de l'étape en cours (pastille, acteur, échéance
 * avec icône), choix d'une décision en boutons secondaires, et historique en
 * frise : une pastille cochée par étape, reliées par un trait.
 */
export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tracking = useTrackings().find((item) => item.id === id);
  const processes = useImportedProcesses();
  const process =
    tracking && (processes.find((item) => item.id === tracking.processId) ?? getProcess(tracking.processId));
  const theme = useTheme();
  const t = useT();

  if (!tracking || !process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title={t.tracking.notFound}
          message={t.tracking.notFoundText}
          action={{ label: t.tracking.back, onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <TrackingDetail tracking={tracking} process={process} />;
}

/** L'heure actuelle, relue toutes les 15 secondes pour que les chronos et les échéances restent justes. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function TrackingDetail({ tracking, process }: { tracking: Tracking; process: Process }) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const current = currentStep(tracking);
  const currents = currentSteps(tracking);
  const waiting = waitingSteps(tracking);
  // Les étapes « En parallèle » (partage, jonction) ne sont que des passages : on ne les liste pas.
  const done = tracking.steps.filter((step) => step.doneAt && stepOf(process, step)?.kind !== 'parallel').reverse();
  const titleOf = (stepId: string) => process.steps.find((step) => step.id === stepId)?.title || t.untitled;
  const sla = slaClock(tracking, now);
  const report = delayReport(tracking);

  // Index dans tracking.steps : avec des tâches en parallèle, on dit quelle étape est terminée.
  const complete = (linkId?: string, index?: number) =>
    saveTracking(completeStep(process, tracking, new Date(), linkId, index));
  const choicesOf = (tracked: TrackedStep) => nextChoices(process, tracking, tracked);
  const olaOf = (tracked: TrackedStep) => olaClock(tracked, now);

  // Une carte par étape en cours : une seule, sauf avec des tâches en parallèle (une par branche).
  const stepCard = (tracked: TrackedStep, position: number) => (
    <View
      key={tracking.steps.indexOf(tracked)}
      style={[styles.card, styles.current, { backgroundColor: theme.surface }]}>
      <View style={styles.pillRow}>
        <View style={[styles.pill, { backgroundColor: theme.primaryBackground }]}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {t.tracking.current}
          </ThemedText>
        </View>
        {position === 0 && done.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {t.tracking.doneCount(done.length)}
          </ThemedText>
        )}
      </View>
      <ThemedText style={styles.currentTitle} accessibilityRole="header">
        {titleOf(tracked.stepId)}
      </ThemedText>
      {stepOf(process, tracked)?.actor && (
        <View style={styles.metaRow}>
          <SymbolView name={{ ios: 'person', android: 'person' }} size={16} tintColor={theme.textSecondary} />
          <ThemedText themeColor="textSecondary">{stepOf(process, tracked)?.actor}</ThemedText>
        </View>
      )}
      {!tracked.dueAt && (
        <View style={styles.metaRow} accessible>
          <SymbolView name={{ ios: 'clock', android: 'schedule' }} size={16} tintColor={theme.textSecondary} />
          <ThemedText style={styles.flex}>{t.tracking.noDue}</ThemedText>
        </View>
      )}
      {olaOf(tracked) && <Clock title={t.delays.ola} clock={olaOf(tracked)!} t={t} />}
      {choicesOf(tracked).length > 1 ? (
        <View style={styles.choices}>
          <ThemedText type="smallBold">{t.tracking.whichNext}</ThemedText>
          {choicesOf(tracked).map((link) => (
            <PrimaryButton
              key={link.id}
              variant="secondary"
              label={`${link.label ?? t.tracking.next} → ${titleOf(link.to)}`}
              onPress={() => complete(link.id, tracking.steps.indexOf(tracked))}
            />
          ))}
        </View>
      ) : (
        <PrimaryButton
          label={choicesOf(tracked).length === 1 ? t.tracking.stepDone : t.tracking.finish}
          accessibilityLabel={
            choicesOf(tracked).length === 1 ? t.tracking.stepDoneGoTo(titleOf(choicesOf(tracked)[0].to)) : undefined
          }
          onPress={() => complete(undefined, tracking.steps.indexOf(tracked))}
        />
      )}
    </View>
  );

  const confirmStop = () =>
    confirmAction(
      t.tracking.stopTitle,
      t.tracking.stopText(tracking.label),
      t.tracking.stopConfirm,
      () => {
        removeTracking(tracking.id);
        router.back();
      },
      t.common.cancel,
    );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerBackTitle: t.detail.back,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.titleBlock}>
          <ThemedText type="title" accessibilityRole="header">
            {tracking.label}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {t.tracking.startedOn(process.name, formatMoment(tracking.startedAt, t))}
          </ThemedText>
        </View>

        {sla && current && <Clock title={t.delays.sla} clock={sla} t={t} />}

        {currents.length > 0 ? (
          <>
            {currents.length > 1 && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t.tracking.parallel(currents.length)}
              </ThemedText>
            )}
            {currents.map(stepCard)}
            {waiting.map((tracked) => (
              <View key={tracking.steps.indexOf(tracked)} style={styles.metaRow}>
                <SymbolView
                  name={{ ios: 'hourglass', android: 'hourglass_empty' }}
                  size={16}
                  tintColor={theme.textSecondary}
                />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {t.tracking.waiting(titleOf(tracked.stepId))}
                </ThemedText>
              </View>
            ))}
          </>
        ) : (
          <View style={[styles.card, styles.current, { backgroundColor: theme.successBackground }]}>
            <View style={[styles.doneIcon, { backgroundColor: theme.success }]}>
              <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={22} weight="bold" tintColor="#ffffff" />
            </View>
            <ThemedText style={[styles.currentTitle, { color: theme.success }]}>{t.tracking.finished}</ThemedText>
            <ThemedText style={{ color: theme.success }}>
              {t.tracking.finishedIn(
                formatMoment(tracking.finishedAt!, t),
                t.format.count(
                  Math.max(0, workingDaysBetween(new Date(tracking.startedAt), new Date(tracking.finishedAt!))),
                  t.words.workingDay,
                ),
              )}
            </ThemedText>
          </View>
        )}

        {report && (report.sla || report.ola.total > 0) && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              {t.delays.reportTitle}
            </ThemedText>
            <View style={[styles.card, styles.report, { backgroundColor: theme.surface }]} accessible>
              {report.sla && (
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.reportIcon,
                      { backgroundColor: report.sla.met ? theme.successBackground : theme.dangerBackground },
                    ]}>
                    <SymbolView
                      name={
                        report.sla.met ? { ios: 'checkmark', android: 'check' } : { ios: 'xmark', android: 'close' }
                      }
                      size={16}
                      weight="bold"
                      tintColor={report.sla.met ? theme.success : theme.danger}
                    />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold" style={{ color: report.sla.met ? theme.success : theme.danger }}>
                      {report.sla.met ? t.delays.slaMet : t.delays.slaMissed}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {(report.sla.met ? t.delays.slaMetText : t.delays.slaMissedText)(
                        workingTime(report.sla.used, t),
                        t.format.count(report.sla.budget, t.words.workingDay),
                        workingTime(report.sla.margin, t),
                      )}
                    </ThemedText>
                  </View>
                </View>
              )}
              {report.ola.total > 0 && (
                <View style={styles.reportLine}>
                  <ThemedText type="smallBold">{t.delays.olaCount(report.ola.met, report.ola.total)}</ThemedText>
                  {report.lateSteps.length > 0 && (
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      {t.delays.olaLate(report.lateSteps.map(titleOf).join(', '))}
                    </ThemedText>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {tracking.answers && tracking.answers.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              {t.tracking.answers}
            </ThemedText>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              {tracking.answers.map((line, index) => (
                <View
                  key={`${line.label}-${index}`}
                  style={[
                    styles.answer,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {line.label}
                  </ThemedText>
                  <ThemedText>{line.answer}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {done.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              {t.tracking.pastSteps}
            </ThemedText>
            <View style={[styles.card, styles.timeline, { backgroundColor: theme.surface }]}>
              {done.map((step, index) => (
                <View key={`${step.stepId}-${step.startedAt}`} accessible style={styles.timelineRow}>
                  <View style={styles.rail} importantForAccessibility="no-hide-descendants">
                    <View style={[styles.dot, { backgroundColor: theme.successBackground }]}>
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check' }}
                        size={13}
                        weight="bold"
                        tintColor={theme.success}
                      />
                    </View>
                    {index < done.length - 1 && <View style={[styles.line, { backgroundColor: theme.border }]} />}
                  </View>
                  <View style={styles.timelineText}>
                    <ThemedText type="smallBold">{titleOf(step.stepId)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t.tracking.doneOn(formatMoment(step.doneAt!, t))}
                    </ThemedText>
                    <View style={styles.badgeRow}>
                      <Badge {...timingBadge(step, now, t)} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <Pressable onPress={confirmStop} accessibilityRole="button" style={styles.stop}>
          <ThemedText type="link" style={{ color: theme.danger }}>
            {t.tracking.stop}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** « 1 j 4 h », « 3 h 05 », « 12 min » : un temps de travail, en valeur absolue. */
function workingTime(days: number, t: Messages): string {
  const parts = splitWorkingTime(days);
  return t.delays.time(parts.days, parts.hours, parts.minutes);
}

/** Le chrono d'un délai : temps restant (ou retard), couleur, barre et échéance. */
function Clock({ title, clock, t }: { title: string; clock: DelayClock; t: Messages }) {
  const late = clock.remaining < 0;
  const time = workingTime(clock.remaining, t);
  const caption = late ? t.delays.lateBy : t.delays.left;
  return (
    <DelayMeter
      title={`${title} · ${t.format.count(clock.budget, t.words.workingDay)}`}
      value={time}
      caption={caption}
      level={clock.level}
      ratio={late ? 1 : clock.ratio}
      footer={t.delays.due(formatMoment(clock.dueAt, t))}
      accessibilityLabel={t.delays.clockLabel(title, time, late, t.delays.levels[clock.level])}
    />
  );
}

const DOT = 26;
const styles = StyleSheet.create({
  answer: { gap: Spacing.half, padding: Spacing.three },
  report: { gap: Spacing.three, padding: Spacing.three },
  reportIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  reportLine: { gap: Spacing.half },
  screen: { flex: 1 },
  content: { gap: Spacing.four, padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  titleBlock: { gap: Spacing.one },
  card: { borderRadius: Radius.large, overflow: 'hidden' },
  current: { gap: Spacing.two + Spacing.half, padding: Spacing.three + Spacing.one },
  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  pill: { paddingHorizontal: Spacing.two + Spacing.one, paddingVertical: Spacing.one, borderRadius: Radius.pill },
  currentTitle: { fontSize: 22, lineHeight: 28, fontWeight: 800, fontFamily: fontFaceFor(800) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badgeRow: { flexDirection: 'row' },
  doneIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  choices: { gap: Spacing.two, marginTop: Spacing.one },
  section: { gap: Spacing.two },
  timeline: { padding: Spacing.three },
  timelineRow: { flexDirection: 'row', gap: Spacing.three },
  rail: { width: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, marginVertical: Spacing.half },
  timelineText: { flex: 1, gap: Spacing.half, paddingBottom: Spacing.three },
  flex: { flex: 1 },
  stop: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
