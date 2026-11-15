import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Badge } from '@/components/badge';
import { PrimaryButton } from '@/components/primary-button';
import { ProcessCard } from '@/components/process-card';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useImportedProcesses } from '@/data/process-store';
import { removeProject, useProjects } from '@/data/project-store';
import { summarize, type Project } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { useT } from '@/i18n';

/**
 * Un projet : son nom, sa description, son chef (pour l'instant, celui qui
 * l'a créé), et les process qui y sont rangés. « Ajouter des process » ouvre
 * la liste de vos process à cocher ; le menu « … » renomme ou supprime le
 * projet (ses process restent, hors projet).
 */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProjects().find((item) => item.id === id);
  const theme = useTheme();
  const t = useT();

  if (!project) {
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
  return <ProjectDetail project={project} />;
}

function ProjectDetail({ project }: { project: Project }) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const imported = useImportedProcesses();
  const items = useMemo(
    () =>
      imported
        .filter((process) => process.projectId === project.id)
        .map((process) => ({ process, summary: summarize(process) })),
    [imported, project.id],
  );

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
  const menu: SheetAction[] = [
    {
      label: t.projects.edit,
      icon: { ios: 'pencil', android: 'edit' },
      onPress: () => router.push({ pathname: '/projet/nouveau', params: { id: project.id } }),
    },
    { label: t.projects.add, icon: { ios: 'plus', android: 'add' }, onPress: openAdd },
    { label: t.projects.delete, icon: { ios: 'trash', android: 'delete' }, onPress: confirmDelete, destructive: true },
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.titleBlock}>
          <View style={styles.pill}>
            <Badge label={t.projects.chef} tone="primary" />
          </View>
          <ThemedText type="title" accessibilityRole="header" style={styles.title}>
            {project.name}
          </ThemedText>
          {project.description && <ThemedText themeColor="textSecondary">{project.description}</ThemedText>}
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.section}>
          {t.projects.processes(items.length)}
        </ThemedText>
        {items.length === 0 && (
          <View style={[styles.empty, { borderColor: theme.fieldBorder }]}>
            <ThemedText themeColor="textSecondary">{t.projects.empty}</ThemedText>
          </View>
        )}
        {items.map(({ process, summary }) => (
          <ProcessCard key={process.id} process={process} summary={summary} />
        ))}
        <PrimaryButton label={t.projects.add} onPress={openAdd} variant="secondary" />
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
});
