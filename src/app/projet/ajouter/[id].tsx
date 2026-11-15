import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { setProcessProject, useImportedProcesses } from '@/data/process-store';
import { useAllProjects } from '@/data/project-view';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * « Ajouter des process » : vos process (importés, pas les exemples ni ceux
 * partagés avec vous), à cocher. Toucher une ligne range le process dans le
 * projet, ou l'en sort ; un process déjà dans un autre projet change de projet.
 * Un collaborateur y range aussi ses propres process.
 */
export default function AddToProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const all = useAllProjects();
  const findProject = (projectId: string | null | undefined) =>
    all.find((item) => item.project.id === projectId)?.project;
  const project = findProject(id);
  const processes = useImportedProcesses();
  const theme = useTheme();
  const t = useT();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t.titles.addToProject }} />
      <FlatList
        data={processes}
        keyExtractor={(process) => process.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            {processes.length > 0 ? t.projects.addIntro : t.projects.addNone}
          </ThemedText>
        }
        renderItem={({ item: process }) => {
          const inThis = process.projectId === id;
          const other = !inThis ? findProject(process.projectId) : undefined;
          return (
            <Pressable
              onPress={() => setProcessProject(process.id, inThis ? null : id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: inThis }}
              accessibilityLabel={process.name}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceMuted : theme.surface }]}>
              <View
                style={[
                  styles.box,
                  inThis
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.fieldBorder },
                ]}>
                {inThis && (
                  <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={16} tintColor={theme.onPrimary} />
                )}
              </View>
              <View style={styles.text}>
                <ThemedText type="smallBold">{process.name}</ThemedText>
                {(inThis || other !== undefined) && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {inThis ? t.projects.inThis : t.projects.inOther(other!.name)}
                  </ThemedText>
                )}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          project ? (
            <View style={styles.footer}>
              <PrimaryButton label={t.projects.done} onPress={() => router.back()} />
            </View>
          ) : undefined
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
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.half },
  footer: { marginTop: Spacing.three },
});
