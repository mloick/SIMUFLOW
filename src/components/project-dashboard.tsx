import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Badge, type BadgeTone } from '@/components/badge';
import { FilterChips } from '@/components/filter-chips';
import { PrimaryButton } from '@/components/primary-button';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDashboardData, type DashboardSource } from '@/data/project-dashboard-data';
import {
  projectDashboard,
  reviewableSteps,
  type DashboardProcess,
  type DashboardStatus,
  type MemberProgress,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { initials } from '@/utils/initials';

/** Un process du projet, avec qui l'a partagé (rien si c'est le mien). */
export type DashboardItem = DashboardSource & { sharedBy?: string };

type Filter = 'tous' | 'a_revoir' | 'en_cours' | 'valide';

const TONES: Record<DashboardStatus, BadgeTone> = {
  a_revoir: 'warning',
  en_relecture: 'primary',
  pas_partage: 'neutral',
  valide: 'success',
};

/** Ce que fait le filtre « En cours » : les process en relecture ou pas encore partagés. */
const IN_FILTER: Record<Filter, (status: DashboardStatus) => boolean> = {
  tous: () => true,
  a_revoir: (status) => status === 'a_revoir',
  en_cours: (status) => status === 'en_relecture' || status === 'pas_partage',
  valide: (status) => status === 'valide',
};

type MemberState = 'fini' | 'signale' | 'en_cours' | 'pas_commence';

function memberState(progress: MemberProgress): MemberState {
  if (progress.toRevise > 0) return 'signale';
  if (progress.state === 'termine') return 'fini';
  return progress.state;
}

/**
 * Tableau de bord d'un projet : où en est la relecture de tous ses process,
 * les étapes signalées à corriger, puis une carte par process. Le calcul est
 * dans `src/domain/dashboard.ts` ; ici, seulement l'affichage.
 */
export function ProjectDashboard({ projectName, items }: { projectName: string; items: DashboardItem[] }) {
  const theme = useTheme();
  const t = useT();
  const d = t.dashboard;
  const insets = useSafeAreaInsets();
  const data = useDashboardData(items);
  const [filter, setFilter] = useState<Filter>('tous');
  const dashboard = useMemo(() => (data.status === 'ready' ? projectDashboard(data.inputs) : null), [data]);
  const sharedBy = useMemo(() => new Map(items.map((item) => [item.process.id, item.sharedBy])), [items]);

  const dots: Record<MemberState, string> = {
    fini: theme.success,
    signale: theme.warning,
    en_cours: theme.link,
    pas_commence: theme.border,
  };

  const header = (
    <View style={styles.titleBlock}>
      <ThemedText type="title" accessibilityRole="header" style={styles.title}>
        {d.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{d.subtitle(projectName, items.length)}</ThemedText>
    </View>
  );

  let body;
  if (data.status === 'loading') {
    body = <ActivityIndicator color={theme.textSecondary} style={styles.loading} />;
  } else if (data.status === 'error') {
    body = (
      <View style={[styles.card, { backgroundColor: theme.surface }]} accessibilityRole="alert">
        <ThemedText style={{ color: theme.danger }}>{d.error}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data.message}
        </ThemedText>
        <PrimaryButton label={t.common.retry} onPress={data.reload} variant="secondary" />
      </View>
    );
  } else if (dashboard && items.length === 0) {
    body = (
      <View style={[styles.empty, { borderColor: theme.fieldBorder }]}>
        <ThemedText themeColor="textSecondary">{d.empty}</ThemedText>
      </View>
    );
  } else if (dashboard) {
    const { counts } = dashboard;
    const shown = dashboard.processes.filter((item) => IN_FILTER[filter](item.status));
    const chips = [
      {
        id: 'tous' as const,
        label: d.filterAll,
        count: dashboard.processes.length,
      },
      {
        id: 'a_revoir' as const,
        label: d.filterToRevise,
        count: counts.a_revoir,
      },
      {
        id: 'en_cours' as const,
        label: d.filterInProgress,
        count: counts.en_relecture + counts.pas_partage,
      },
      { id: 'valide' as const, label: d.filterValidated, count: counts.valide },
    ];
    const counters = [
      {
        n: counts.valide,
        label: d.counterValidated(counts.valide),
        color: theme.success,
        background: theme.successBackground,
      },
      {
        n: counts.en_relecture + counts.pas_partage,
        label: d.counterInProgress,
        color: theme.link,
        background: theme.primaryBackground,
      },
      {
        n: counts.a_revoir,
        label: d.counterToRevise,
        color: theme.warning,
        background: theme.warningBackground,
      },
    ];
    body = (
      <>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.summary}>
            <ProgressRing percent={dashboard.percent} label={d.percentLabel(dashboard.percent)} />
            <View style={styles.flex}>
              <ThemedText type="subtitle" style={styles.summaryTitle}>
                {d.reviewed(dashboard.reviewed, dashboard.expected)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {d.validatedOf(counts.valide, dashboard.processes.length)}
                {d.waiting(dashboard.waitingOn.length)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.counters}>
            {counters.map((counter) => (
              <View key={counter.label} style={[styles.counter, { backgroundColor: counter.background }]}>
                <ThemedText style={[styles.counterNumber, { color: counter.color }]}>{counter.n}</ThemedText>
                <ThemedText type="smallBold" style={{ color: counter.color }}>
                  {counter.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {dashboard.issues.length > 0 && (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.section}>
              {d.issues.toUpperCase()}
            </ThemedText>
            {dashboard.issues.map((issue) => (
              <Pressable
                key={`${issue.process.id}:${issue.step.id}:${issue.member.id}`}
                onPress={() =>
                  router.push({
                    pathname: '/process/[id]',
                    params: { id: issue.process.id },
                  })
                }
                accessibilityRole="button"
                accessibilityHint={d.issueHint}
                style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.row}>
                  <View style={[styles.issueIcon, { backgroundColor: theme.warningBackground }]}>
                    <SymbolView
                      name={{
                        ios: 'exclamationmark.triangle',
                        android: 'warning',
                      }}
                      size={18}
                      tintColor={theme.warning}
                    />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{issue.step.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.issueWhere(issue.process.name, issue.process.steps.indexOf(issue.step) + 1)}
                    </ThemedText>
                  </View>
                  <SymbolView
                    name={{ ios: 'chevron.right', android: 'chevron_right' }}
                    size={16}
                    tintColor={theme.textSecondary}
                  />
                </View>
                <View style={[styles.quote, { backgroundColor: theme.surfaceMuted }]}>
                  <ThemedText type="small">{d.quote(issue.comment)}</ThemedText>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {d.issueBy(issue.member.name, issue.member.actor)}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </>
        )}

        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.section}>
          {d.processes.toUpperCase()}
        </ThemedText>
        <FilterChips chips={chips} current={filter} onChange={setFilter} />
        {shown.length === 0 && (
          <View style={[styles.empty, { borderColor: theme.fieldBorder }]}>
            <ThemedText themeColor="textSecondary">{d.emptyFilter}</ThemedText>
          </View>
        )}
        {shown.map((item) => (
          <ProcessRow key={item.process.id} item={item} sharedBy={sharedBy.get(item.process.id)} dots={dots} />
        ))}

        <View style={styles.legend}>
          {(
            [
              [dots.fini, d.legendDone],
              [dots.en_cours, d.legendInProgress],
              [dots.signale, d.legendIssue],
              [dots.pas_commence, d.legendNotStarted],
            ] as const
          ).map(([color, label]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
            </View>
          ))}
        </View>
      </>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={false} onRefresh={data.reload} />}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
      {header}
      {body}
    </ScrollView>
  );
}

/** Le cercle d'avancement, avec le pourcentage au milieu. */
function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const theme = useTheme();
  const size = 84;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <View style={styles.ring} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.surfaceMuted} strokeWidth={stroke} fill="none" />
        {percent > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.primary}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(length * percent) / 100} ${length}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.ringLabel}>
        <ThemedText style={styles.ringText}>{percent} %</ThemedText>
      </View>
    </View>
  );
}

function ProcessRow({
  item,
  sharedBy,
  dots,
}: {
  item: DashboardProcess;
  sharedBy?: string;
  dots: Record<MemberState, string>;
}) {
  const theme = useTheme();
  const t = useT();
  const d = t.dashboard;
  const { process, status, overview } = item;
  const steps = reviewableSteps(process).length;
  const validated = overview.members.reduce((sum, member) => sum + member.validated, 0);
  const toRevise = overview.members.reduce((sum, member) => sum + member.toRevise, 0);
  const width = (n: number) => (item.expected === 0 ? '0%' : `${(n / item.expected) * 100}%`) as `${number}%`;
  const mine = sharedBy === undefined;
  const open = () => router.push({ pathname: '/process/[id]', params: { id: process.id } });

  let line: string;
  if (overview.toReviseCount > 0) line = d.toRevise(overview.toReviseCount);
  else if (overview.fullyValidated) line = d.allDone;
  else line = d.done(overview.doneCount, overview.members.length);

  return (
    // Une carte, pas un bouton : « Partager » ne peut pas être un bouton dans un bouton.
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityHint={d.issueHint} style={styles.cardPress}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={styles.processName} numberOfLines={1}>
              {process.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {mine ? d.mine(steps) : d.owner(sharedBy, steps)}
            </ThemedText>
          </View>
          <Badge label={d.status[status]} tone={TONES[status]} />
        </View>
        {status !== 'pas_partage' && (
          <>
            <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
              <View
                style={{
                  width: width(validated),
                  backgroundColor: theme.success,
                }}
              />
              <View style={{ width: width(toRevise), backgroundColor: theme.warning }} />
            </View>
            <View style={styles.row}>
              <View style={styles.avatars}>
                {overview.members.map((progress) => {
                  const state = memberState(progress);
                  return (
                    <View
                      key={progress.member.id}
                      accessible
                      accessibilityLabel={d.member(progress.member.name, d.memberState[state])}
                      style={[styles.avatar, { backgroundColor: theme.primaryBackground }]}>
                      <ThemedText style={[styles.avatarText, { color: theme.link }]}>
                        {initials(progress.member.name)}
                      </ThemedText>
                      <View
                        style={[
                          styles.avatarDot,
                          {
                            backgroundColor: dots[state],
                            borderColor: theme.surface,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {line}
              </ThemedText>
            </View>
          </>
        )}
      </Pressable>
      {status === 'pas_partage' && (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {d.notShared}
          </ThemedText>
          {mine && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/partage/[id]',
                  params: { id: process.id },
                })
              }
              accessibilityRole="button"
              accessibilityHint={d.shareHint}
              style={[styles.share, { backgroundColor: theme.primaryBackground }]}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                {d.share}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleBlock: { gap: Spacing.one, marginBottom: Spacing.two },
  title: { fontWeight: 800, letterSpacing: -0.8, fontSize: 30, lineHeight: 36 },
  loading: { marginTop: Spacing.five },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  cardPress: { gap: Spacing.three - Spacing.one },
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three - Spacing.one,
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  summaryTitle: { fontSize: 17, lineHeight: 22, fontWeight: 800 },
  counters: { flexDirection: 'row', gap: Spacing.two },
  counter: {
    flex: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three - Spacing.one,
  },
  counterNumber: { fontSize: 22, lineHeight: 28, fontWeight: 800 },
  ring: { width: 84, height: 84 },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { fontSize: 20, lineHeight: 26, fontWeight: 800 },
  section: { marginTop: Spacing.two, letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  issueIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quote: {
    borderRadius: Radius.medium,
    padding: Spacing.two + 2,
    gap: Spacing.one,
  },
  processName: { fontSize: 16, lineHeight: 22 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  avatars: { flexDirection: 'row', gap: Spacing.one },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, lineHeight: 14, fontWeight: 800 },
  avatarDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  share: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.large,
    padding: Spacing.three,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
