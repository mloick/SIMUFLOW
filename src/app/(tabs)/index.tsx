import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SharedProcess } from '@/backend/shared';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { HomeHeader } from '@/components/home-header';
import { ListSkeleton } from '@/components/list-skeleton';
import { PressableScale } from '@/components/pressable-scale';
import { ProcessCard } from '@/components/process-card';
import { ResumeCard } from '@/components/resume-card';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { fontFaceFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { splitExamples } from '@/data/examples';
import { useProcessList } from '@/data/process-list';
import { useSharedProcesses } from '@/data/shared-store';
import { useTrackings } from '@/data/tracking-store';
import { useWelcomeSeen } from '@/data/welcome-setting';
import { summarize, type Process, type ProcessSummary } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { normalizeForSearch } from '@/utils/format';
import type { Tracking } from '@/tracking/tracking';
import { useT } from '@/i18n';

const NO_PROCESSES: Process[] = [];
const NO_SHARED: SharedProcess[] = [];

type Filter = 'all' | 'fix' | 'shared' | 'examples';

/** Une ligne de la liste : une carte, un titre de section, ou l'invitation à ajouter un process. */
type Row =
  | { kind: 'card'; process: Process; summary: ProcessSummary; sharedBy?: string }
  | { kind: 'shared'; count: number }
  | { kind: 'examples'; count: number }
  | { kind: 'hint' };

type Item = { process: Process; summary: ProcessSummary; sharedBy?: string };

const hasIssues = (item: Item) => item.summary.errorCount + item.summary.warningCount > 0;

/**
 * Accueil (refonte, étape R6) : bonjour et avatar, cloche des alertes,
 * recherche, filtres (Tous, À corriger, Partagés, Exemples), carte « Reprendre »
 * et bouton flottant « Nouveau ». Garde les états de la liste : chargement,
 * vide, erreur, hors connexion et contenu.
 */
export default function ProcessListScreen() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const list = useProcessList();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const reduceMotion = useReducedMotion();
  const welcomeSeen = useWelcomeSeen();
  const shared = useSharedProcesses();
  const trackings = useTrackings();

  // Premier lancement : l'écran de lancement s'ouvre par-dessus la liste.
  const pathname = usePathname();
  useEffect(() => {
    // L'écran de lancement (connexion ou « Continuer sans compte »), puis la présentation.
    // Seulement depuis la liste : pas par-dessus la page d'un lien d'acteur, ouverte par quelqu'un
    // qui n'utilise pas l'app, ni de nouveau pendant que le lancement est affiché.
    if (!welcomeSeen && pathname === '/') router.push({ pathname: '/connexion', params: { lancement: '1' } });
  }, [welcomeSeen, pathname]);

  const processes = list.status === 'ready' ? list.processes : NO_PROCESSES;
  const sharedReady = list.status === 'ready' ? shared : NO_SHARED;

  // Les trois groupes, avec leur diagnostic, une seule fois.
  const groups = useMemo(() => {
    const { own, examples } = splitExamples(processes);
    const item = (process: Process, sharedBy?: string): Item => ({ process, summary: summarize(process), sharedBy });
    return {
      own: own.map((process) => item(process)),
      shared: sharedReady.map((entry) => item(entry.process, entry.ownerName)),
      examples: examples.map((process) => item(process)),
    };
  }, [processes, sharedReady]);

  const chips: FilterChip<Filter>[] = [
    { id: 'all', label: t.list.filter.all, count: groups.own.length + groups.shared.length + groups.examples.length },
    { id: 'fix', label: t.list.filter.fix, count: [...groups.own, ...groups.shared].filter(hasIssues).length },
    { id: 'shared', label: t.list.filter.shared, count: groups.shared.length },
    { id: 'examples', label: t.list.filter.examples, count: groups.examples.length },
  ].filter((chip) => chip.id === 'all' || chip.id === filter || chip.count > 0) as FilterChip<Filter>[];

  // « Tous » : vos process, puis ceux partagés avec vous, puis les exemples, chacun sous son titre.
  // Les autres filtres : une seule liste, sans titre.
  const rows = useMemo(() => {
    const search = normalizeForSearch(query);
    const matches = (items: Item[]) => items.filter((it) => normalizeForSearch(it.process.name).includes(search));
    const cards = (items: Item[]): Row[] => items.map((it) => ({ kind: 'card', ...it }));
    if (filter === 'fix') return cards(matches([...groups.own, ...groups.shared].filter(hasIssues)));
    if (filter === 'shared') return cards(matches(groups.shared));
    if (filter === 'examples') return cards(matches(groups.examples));
    const own = matches(groups.own);
    const sharedMatches = matches(groups.shared);
    const examples = matches(groups.examples);
    const result: Row[] = cards(own);
    if (own.length === 0 && sharedMatches.length === 0 && !search && examples.length > 0) result.push({ kind: 'hint' });
    if (sharedMatches.length > 0) result.push({ kind: 'shared', count: sharedMatches.length }, ...cards(sharedMatches));
    if (examples.length > 0) result.push({ kind: 'examples', count: examples.length }, ...cards(examples));
    return result;
  }, [groups, query, filter]);

  // « Reprendre » : la dernière demande suivie en vrai qui n'est pas terminée.
  // (React Compiler garde ce calcul en mémoire tant que rien ne change.)
  const allProcesses = [...processes, ...sharedReady.map((entry) => entry.process)];
  const resume = trackings
    .filter((tracking) => !tracking.finishedAt)
    .map((tracking) => ({ tracking, process: allProcesses.find((item) => item.id === tracking.processId) }))
    .find((entry): entry is { tracking: Tracking; process: Process } => !!entry.process);

  const openImport = () => router.push('/import');
  const hasProcesses = processes.length > 0 || sharedReady.length > 0;

  const header = (
    <View style={styles.header}>
      <HomeHeader />
      <ThemedText type="title" accessibilityRole="header" style={styles.title}>
        {t.list.title}
      </ThemedText>
      {list.status === 'loading' && <View style={[styles.search, { backgroundColor: theme.surface }]} />}
      {list.status === 'ready' && hasProcesses && (
        <>
          <View style={[styles.search, { backgroundColor: theme.surface }]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search' }}
              size={19}
              tintColor={theme.textSecondary}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t.list.search}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t.list.search}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
          {chips.length > 1 && <FilterChips chips={chips} current={filter} onChange={setFilter} />}
        </>
      )}
      {list.status === 'ready' && list.offline && (
        <View style={[styles.offline, { backgroundColor: theme.warningBackground }]} accessibilityRole="alert">
          <SymbolView name={{ ios: 'wifi.slash', android: 'wifi_off' }} size={18} tintColor={theme.warning} />
          <ThemedText type="small" style={[styles.offlineText, { color: theme.warning }]}>
            {t.list.offline}
          </ThemedText>
        </View>
      )}
      {resume && filter === 'all' && !query.trim() && (
        <ResumeCard tracking={resume.tracking} process={resume.process} />
      )}
    </View>
  );

  let empty;
  if (list.status === 'loading') {
    empty = <ListSkeleton />;
  } else if (list.status === 'error') {
    empty = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title={t.list.errorTitle}
        message={t.list.errorText}
        action={{ label: t.common.retry, onPress: list.reload }}
      />
    );
  } else if (!hasProcesses) {
    empty = (
      <StateMessage
        icon={{ ios: 'list.bullet.rectangle', android: 'account_tree' }}
        tone="primary"
        title={t.list.emptyTitle}
        message={t.list.emptyText}
        action={{ label: t.list.add, onPress: openImport }}
      />
    );
  } else {
    empty = (
      <ThemedText themeColor="textSecondary" style={styles.noResult}>
        {query.trim() ? t.list.noMatch(query.trim()) : t.list.noneInFilter}
      </ThemedText>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === 'card' ? row.process.id : row.kind)}
        renderItem={({ item: row, index }) => {
          if (row.kind === 'hint') {
            return (
              <View style={[styles.hint, { borderColor: theme.fieldBorder }]}>
                <ThemedText themeColor="textSecondary">{t.list.hint}</ThemedText>
              </View>
            );
          }
          if (row.kind === 'shared' || row.kind === 'examples') {
            return (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
                  {row.kind === 'shared' ? t.list.shared(row.count) : t.list.examples(row.count)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.kind === 'shared' ? t.list.sharedHint : t.list.examplesHint}
                </ThemedText>
              </View>
            );
          }
          return (
            // Les cartes arrivent l'une après l'autre en glissant vers le haut ;
            // rien ne bouge si « Réduire les animations » est activé.
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
              <ProcessCard process={row.process} summary={row.summary} sharedBy={row.sharedBy} />
            </Animated.View>
          );
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 110 }]}
      />

      {list.status === 'ready' && hasProcesses && (
        <PressableScale
          onPress={openImport}
          accessibilityRole="button"
          accessibilityLabel={t.list.add}
          style={[styles.fab, { backgroundColor: theme.text, bottom: insets.bottom + Spacing.three }]}>
          <SymbolView name={{ ios: 'plus', android: 'add' }} size={22} weight="bold" tintColor={theme.background} />
          <ThemedText style={[styles.fabText, { color: theme.background }]} maxFontSizeMultiplier={1.4}>
            {t.list.newProcess}
          </ThemedText>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  title: {
    fontWeight: 800,
    letterSpacing: -0.8,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fontFaceFor(400),
    paddingVertical: Spacing.two,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three - Spacing.one,
  },
  offlineText: {
    flex: 1,
  },
  hint: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.large,
    padding: Spacing.three,
  },
  section: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  noResult: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  fab: {
    position: 'absolute',
    right: Spacing.three + Spacing.one,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three + Spacing.half,
    paddingRight: Spacing.four - Spacing.half,
    borderRadius: Radius.pill,
    boxShadow: '0 10px 24px rgba(14, 27, 44, 0.25)',
  },
  fabText: {
    fontSize: 16,
    fontWeight: 800,
  },
});
