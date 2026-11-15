import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { setProcessProject } from '@/data/process-store';
import { createProject, getProject, updateProject } from '@/data/project-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Créer un projet (nom, description facultative), ou le renommer (`?id=`).
 * Ouvert depuis « Ranger dans un projet » (`?process=`), le process y est
 * rangé dès la création. Le créateur est le chef du projet.
 */
export default function ProjectFormScreen() {
  const { id, process } = useLocalSearchParams<{ id?: string; process?: string }>();
  const existing = getProject(id);
  const theme = useTheme();
  const t = useT();
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setError(t.projects.nameRequired);
      return;
    }
    if (existing) {
      updateProject(existing.id, name, description);
      router.back();
      return;
    }
    const project = createProject(name, description);
    if (process) {
      // Venu de la fiche d'un process : on y revient, le process est rangé.
      setProcessProject(process, project.id);
      router.dismissTo({ pathname: '/process/[id]', params: { id: process } });
      return;
    }
    router.replace({ pathname: '/projet/[id]', params: { id: project.id } });
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder }];
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? t.titles.editProject : t.titles.newProject }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!existing && <ThemedText themeColor="textSecondary">{t.projects.formIntro}</ThemedText>}

        <View style={styles.field}>
          <ThemedText type="smallBold">{t.projects.nameLabel}</ThemedText>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            placeholder={t.projects.namePlaceholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.projects.nameLabel}
            maxLength={200}
            autoFocus={!existing}
            returnKeyType="next"
            style={input}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">{t.projects.descriptionLabel}</ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t.projects.descriptionPlaceholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.projects.descriptionLabel}
            maxLength={1000}
            multiline
            style={[input, styles.multiline]}
          />
        </View>

        {error && (
          <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          </View>
        )}

        <PrimaryButton label={existing ? t.common.save : t.projects.create} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.four, padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  field: { gap: Spacing.one },
  input: { minHeight: 48, borderRadius: Radius.small, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: Spacing.three, textAlignVertical: 'top' },
  notice: { padding: Spacing.three, borderRadius: Radius.medium },
});
