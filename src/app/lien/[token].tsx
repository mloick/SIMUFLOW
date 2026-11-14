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
import { getT, useT } from '@/i18n';

/**
 * Page d'un lien d'acteur, ouverte dans le navigateur, sans compte : la
 * personne confirme qu'elle est l'acteur du lien en écrivant son nom, puis
 * relit sa partie comme un membre (valider, ou à revoir avec un commentaire).
 */
export default function LinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const t = useT();
  const l = t.review.link;
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
        (cause: unknown) => setError(cause instanceof Error ? cause.message : getT().review.link.openError),
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
        title={l.notFound}
        message={error}
        action={{ label: l.openApp, onPress: () => router.replace('/') }}
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
        <ThemedText>{l.intro(view.ownerName, view.actor)}</ThemedText>
        <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="smallBold" nativeID="nom">
            {l.areYou(view.actor)}
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={l.namePlaceholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={l.nameLabel}
            autoComplete="name"
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={confirm}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.fieldBorder },
            ]}
          />
          <PrimaryButton label={l.confirm} onPress={confirm} disabled={!name.trim()} />
          <ThemedText type="small" themeColor="textSecondary">
            {l.nameNote(view.ownerName)}
          </ThemedText>
        </View>
      </ScrollView>
    );
  } else {
    body = (
      <ReviewPanel
        shared={{ process: view.process, actor: view.actor, ownerName: view.ownerName }}
        api={api}
        note={l.ownerSees(view.ownerName, confirmed)}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.link,
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
