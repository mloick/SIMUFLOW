import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { openLink, reviewByLink, unreviewByLink, type LinkView } from '@/backend/links';
import { PrimaryButton } from '@/components/primary-button';
import { ReviewPanel, type ReviewApi } from '@/components/review-panel';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Page d'un lien d'acteur, ouverte dans le navigateur, sans compte : la
 * personne confirme qu'elle est l'acteur du lien en écrivant son nom, puis
 * relit sa partie comme un membre (valider, ou à revoir avec un commentaire).
 */
export default function LinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const [view, setView] = useState<LinkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const fetchView = useCallback(
    () =>
      openLink(token ?? '').then(
        (next) => {
          setView(next);
          if (next.reviewerName) setName(next.reviewerName);
        },
        (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Le lien n’a pas pu s’ouvrir.'),
      ),
    [token],
  );

  useEffect(() => {
    fetchView();
  }, [fetchView]);

  const api = useMemo<ReviewApi | null>(
    () =>
      view && confirmed
        ? {
            load: async () => view.reviews,
            save: (review) => reviewByLink(token ?? '', confirmed, review),
            remove: (stepId) => unreviewByLink(token ?? '', stepId),
          }
        : null,
    [view, confirmed, token],
  );

  let body;
  if (error) {
    body = (
      <StateMessage
        icon={{ ios: 'link', android: 'link_off' }}
        tone="danger"
        title="Lien introuvable"
        message={error}
        action={{ label: 'Ouvrir SimuFlow', onPress: () => router.replace('/') }}
      />
    );
  } else if (!view) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  } else if (!confirmed || !api) {
    const confirm = () => name.trim() && setConfirmed(name.trim());
    body = (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">{view.process.name}</ThemedText>
        <ThemedText>
          {view.ownerName} vous demande de relire la partie « {view.actor} » de ce process : pour chaque étape, dites si
          elle est juste ou à revoir. Pas besoin de compte.
        </ThemedText>
        <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="smallBold" nativeID="nom">
            Vous êtes « {view.actor} » ? Écrivez votre nom pour le confirmer.
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Prénom Nom"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Votre nom"
            autoComplete="name"
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={confirm}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.fieldBorder },
            ]}
          />
          <PrimaryButton label="C’est moi, je relis ma partie" onPress={confirm} disabled={!name.trim()} />
          <ThemedText type="small" themeColor="textSecondary">
            Votre nom accompagne chacun de vos avis : {view.ownerName} saura qui a relu. Si ce lien n’est pas pour vous,
            fermez simplement la page.
          </ThemedText>
        </View>
      </ScrollView>
    );
  } else {
    body = (
      <ReviewPanel
        shared={{ process: view.process, actor: view.actor, ownerName: view.ownerName }}
        api={api}
        note={`${view.ownerName} voit vos avis, signés « ${confirmed} ». Vous pouvez les changer tant que le lien existe.`}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Relire ma partie',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
        }}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  box: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
