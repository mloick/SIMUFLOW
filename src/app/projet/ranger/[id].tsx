import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess, setProcessProject, useImportedProcesses } from '@/data/process-store';
import { useAllProjects } from '@/data/project-view';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * « Ranger dans un projet », depuis la fiche d'un process : la liste de vos
 * projets (ceux que je dirige et ceux de mon équipe), « Aucun projet » pour l'en sortir, et « Nouveau projet », qui crée
 * le projet et y range le process.
 */
export default function PickProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useImportedProcesses(); // relit le projet du process
  const process = getProcess(id);
  const projects = useAllProjects();
  const theme = useTheme();
  const t = useT();
  const current = process?.projectId ?? null;
  const options = [
    ...projects.map(({ project }) => ({ id: project.id as string | null, label: project.name })),
    { id: null, label: t.projects.noProject },
  ];

  const pick = (projectId: string | null) => {
    if (projectId !== current) setProcessProject(id, projectId);
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t.titles.pickProject }} />
      <FlatList
        data={options}
        keyExtractor={(option) => option.id ?? 'aucun'}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            {t.projects.pickIntro}
          </ThemedText>
        }
        renderItem={({ item: option }) => {
          const selected = option.id === current;
          return (
            <Pressable
              onPress={() => pick(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceMuted : theme.surface }]}>
              <SymbolView
                name={option.id ? { ios: 'folder', android: 'folder' } : { ios: 'tray', android: 'inbox' }}
                size={20}
                tintColor={theme.link}
              />
              <ThemedText style={styles.label}>{option.label}</ThemedText>
              {selected && (
                <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={18} tintColor={theme.link} />
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <PrimaryButton
              label={t.projects.new}
              variant="secondary"
              onPress={() => router.push({ pathname: '/projet/nouveau', params: { process: id } })}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.two, padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  intro: { marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  label: { flex: 1 },
  footer: { marginTop: Spacing.three },
});
