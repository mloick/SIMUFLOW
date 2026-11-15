import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SharedProcess } from '@/backend/shared';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { PressableScale } from '@/components/pressable-scale';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProcessList } from '@/data/process-list';
import { useAllProjects, type ProjectView } from '@/data/project-view';
import { useSharedProcesses } from '@/data/shared-store';
import type { Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const NO_PROCESSES: Process[] = [];
const NO_SHARED: SharedProcess[] = [];

type Filter = 'all' | 'chef' | 'collaborateur';

/**
 * Onglet Projets (étape 3 des projets, maquette écran 12) : les projets que je
 * pilote, puis ceux où je suis collaborateur, avec des filtres, le nombre de
 * process de chacun et mon rôle. « Nouveau projet » en bas à droite.
 */
export default function ProjectsTabScreen() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const projects = useAllProjects();
  const list = useProcessList();
  const shared = useSharedProcesses();
  const [filter, setFilter] = useState<Filter>('all');

  const processes = list.status === 'ready' ? list.processes : NO_PROCESSES;
  const sharedReady = list.status === 'ready' ? shared : NO_SHARED;
  const all = [...processes, ...sharedReady.map((entry) => entry.process)];
  const countOf = (id: string) => all.filter((process) => process.projectId === id).length;

  const led = projects.filter((view) => view.role === 'chef');
  const joined = projects.filter((view) => view.role !== 'chef');
  const chips: FilterChip<Filter>[] = [
    { id: 'all', label: t.projects.filterAll, count: projects.length },
    { id: 'chef', label: t.projects.filterChef, count: led.length },
    { id: 'collaborateur', label: t.projects.filterCollaborator, count: joined.length },
  ];
  const sections = [
    { key: 'chef', title: t.projects.sectionChef, items: filter === 'collaborateur' ? [] : led },
    { key: 'collaborateur', title: t.projects.sectionCollaborator, items: filter === 'chef' ? [] : joined },
  ].filter((section) => section.items.length > 0);

  const openNew = () => router.push('/projet/nouveau');

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.header}>
          <ThemedText type="title" accessibilityRole="header" style={styles.title}>
            {t.projects.tabTitle}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{t.projects.tabIntro}</ThemedText>
        </View>

        {projects.length === 0 ? (
          <StateMessage
            icon={{ ios: 'folder.badge.plus', android: 'create_new_folder' }}
            tone="primary"
            title={t.projects.emptyTitle}
            message={t.projects.emptyText}
            action={{ label: t.projects.new, onPress: openNew }}
          />
        ) : (
          <>
            <FilterChips chips={chips} current={filter} onChange={setFilter} />
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
                  {section.title.toUpperCase()}
                </ThemedText>
                {section.items.map((view, index) => (
                  <Animated.View
                    key={view.project.id}
                    entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
                    <ProjectCard view={view} count={countOf(view.project.id)} />
                  </Animated.View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {projects.length > 0 && (
        <PressableScale
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel={t.projects.new}
          style={[styles.fab, { backgroundColor: theme.text, bottom: insets.bottom + Spacing.three }]}>
          <SymbolView name={{ ios: 'plus', android: 'add' }} size={22} weight="bold" tintColor={theme.background} />
          <ThemedText style={[styles.fabText, { color: theme.background }]} maxFontSizeMultiplier={1.4}>
            {t.projects.new}
          </ThemedText>
        </PressableScale>
      )}
    </View>
  );
}

/** Une carte de projet : nom, nombre de process (et chef pour un collaborateur), pastille du rôle. */
function ProjectCard({ view, count }: { view: ProjectView; count: number }) {
  const theme = useTheme();
  const t = useT();
  const { project, role, chefName } = view;
  const isChef = role === 'chef';
  const badge = isChef ? t.projects.chefBadge : t.projects.collaboratorBadge;
  const meta = [t.projects.count(count), !isChef && chefName ? t.projects.chefLine(chefName) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/projet/[id]', params: { id: project.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${meta}, ${badge}`}
      accessibilityHint={t.projects.openHint}
      style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={[styles.icon, { backgroundColor: isChef ? theme.primaryBackground : theme.surfaceMuted }]}>
        <SymbolView
          name={{ ios: 'folder.fill', android: 'folder' }}
          size={22}
          tintColor={isChef ? theme.link : theme.textSecondary}
        />
      </View>
      <View style={styles.cardText}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.cardName}>
          {project.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {meta}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: isChef ? theme.link : theme.surfaceMuted }]}>
          <ThemedText type="smallBold" style={{ color: isChef ? theme.background : theme.text }}>
            {badge}
          </ThemedText>
        </View>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={16} tintColor={theme.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.two, paddingTop: Spacing.three },
  title: { fontWeight: 800, letterSpacing: -0.8 },
  section: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: Spacing.half },
  cardName: { fontSize: 16 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
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
  fabText: { fontSize: 16, fontWeight: 800 },
});
