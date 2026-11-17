import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { leaveProject } from '@/backend/project-team';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Badge } from '@/components/badge';
import { PrimaryButton } from '@/components/primary-button';
import { ProcessCard } from '@/components/process-card';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { TeamPanel } from '@/components/team-panel';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { syncNow } from '@/data/cloud-sync';
import { useImportedProcesses } from '@/data/process-store';
import { removeProject } from '@/data/project-store';
import { projectProcesses, useAllProjects, type ProjectView } from '@/data/project-view';
import { useSharedProcesses } from '@/data/shared-store';
import { dropTeamProject } from '@/data/team-projects-store';
import { summarize } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { useT } from '@/i18n';

/**
 * Un projet : son nom, sa description, mon rôle (chef ou collaborateur), ses
 * process (les miens et ceux de l'équipe) et son équipe (`TeamPanel`).
 * « Ajouter des process » ouvre la liste de mes process à cocher. Le menu « … »
 * renomme ou supprime le projet pour le chef, et permet au collaborateur de
 * le quitter (ses process en sortent).
 */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useAllProjects().find((item) => item.project.id === id);
  const theme = useTheme();
  const t = useT();

  if (!view) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <StateMessage
          icon={{ ios: 'folder.badge.questionmark', android: 'folder_off' }}
          tone="danger"
          title={t.projects.notFound}
          message={t.projects.notFoundText}
          action={{ label: t.projects.back, onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <ProjectDetail view={view} />;
}

function ProjectDetail({ view }: { view: ProjectView }) {
  const { project, role, chefName } = view;
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const imported = useImportedProcesses();
  const shared = useSharedProcesses();
  const items = useMemo(
    () => projectProcesses(project.id, imported, shared).map((item) => ({ ...item, summary: summarize(item.process) })),
    [imported, shared, project.id],
  );
  const isChef = role === 'chef';

  const openAdd = () => router.push({ pathname: '/projet/ajouter/[id]', params: { id: project.id } });
  const confirmDelete = () =>
    confirmAction(
      t.projects.deleteTitle,
      t.projects.deleteText(project.name),
      t.projects.delete,
      () => {
        removeProject(project.id);
        router.back();
      },
      t.common.cancel,
    );
  const confirmLeave = () =>
    confirmAction(
      t.projects.team.leaveTitle,
      t.projects.team.leaveText(project.name),
      t.projects.team.leave,
      async () => {
        try {
          await leaveProject(project.id);
          dropTeamProject(project.id);
          syncNow();
          router.back();
        } catch (cause) {
          setLeaveError(cause instanceof Error ? cause.message : t.projects.team.loadError);
        }
      },
      t.common.cancel,
    );
  const menu: SheetAction[] = isChef
    ? [
        {
          label: t.projects.edit,
          icon: { ios: 'pencil', android: 'edit' },
          onPress: () => router.push({ pathname: '/projet/nouveau', params: { id: project.id } }),
        },
        { label: t.projects.add, icon: { ios: 'plus', android: 'add' }, onPress: openAdd },
        {
          label: t.projects.delete,
          icon: { ios: 'trash', android: 'delete' },
          onPress: confirmDelete,
          destructive: true,
        },
      ]
    : [
        { label: t.projects.add, icon: { ios: 'plus', android: 'add' }, onPress: openAdd },
        {
          label: t.projects.team.leave,
          icon: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
          onPress: confirmLeave,
          destructive: true,
        },
      ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerRight: () => (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t.projects.menu}
              hitSlop={8}
              style={[styles.more, { backgroundColor: theme.surface }]}>
              <SymbolView name={{ ios: 'ellipsis', android: 'more_horiz' }} size={20} tintColor={theme.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.titleBlock}>
          <View style={styles.pill}>
            <Badge
              label={isChef ? t.projects.chef : t.projects.team.collaboratorOf(chefName ?? '')}
              tone={isChef ? 'primary' : 'neutral'}
            />
          </View>
          <ThemedText type="title" accessibilityRole="header" style={styles.title}>
            {project.name}
          </ThemedText>
          {project.description && <ThemedText themeColor="textSecondary">{project.description}</ThemedText>}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/projet/tableau/[id]', params: { id: project.id } })}
          accessibilityRole="button"
          accessibilityHint={t.dashboard.openHint}
          style={[styles.dashboard, { backgroundColor: theme.surface }]}>
          <View style={[styles.dashboardIcon, { backgroundColor: theme.primaryBackground }]}>
            <SymbolView name={{ ios: 'chart.bar.xaxis', android: 'bar_chart' }} size={20} tintColor={theme.link} />
          </View>
          <View style={styles.dashboardText}>
            <ThemedText type="smallBold">{t.dashboard.open}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.dashboard.openHint}
            </ThemedText>
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right' }}
            size={16}
            tintColor={theme.textSecondary}
          />
        </Pressable>

        {leaveError && (
          <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
            <ThemedText type="small" style={{ color: theme.danger }}>
              {leaveError}
            </ThemedText>
          </View>
        )}

        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.section}>
          {t.projects.processes(items.length)}
        </ThemedText>
        {items.length === 0 && (
          <View style={[styles.empty, { borderColor: theme.fieldBorder }]}>
            <ThemedText themeColor="textSecondary">{t.projects.empty}</ThemedText>
          </View>
        )}
        {items.map(({ process, summary, sharedBy }) => (
          <ProcessCard key={process.id} process={process} summary={summary} sharedBy={sharedBy} />
        ))}
        <PrimaryButton label={t.projects.add} onPress={openAdd} variant="secondary" />

        <TeamPanel projectId={project.id} role={role} />
      </ScrollView>
      <ActionSheet visible={menuOpen} title={t.projects.menu} actions={menu} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { gap: Spacing.two, marginBottom: Spacing.two },
  pill: { flexDirection: 'row' },
  title: { fontWeight: 800, letterSpacing: -0.8, fontSize: 30, lineHeight: 36 },
  section: { marginTop: Spacing.two },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.large, padding: Spacing.three },
  notice: { padding: Spacing.three, borderRadius: Radius.medium },
  dashboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  dashboardIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dashboardText: { flex: 1, gap: 2 },
});
