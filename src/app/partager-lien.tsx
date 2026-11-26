import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/backend/auth';
import { isLinkExpired, linkNeedsExtension } from '@/backend/links';
import {
  createViewLink,
  extendViewLink,
  listViewLinks,
  processWorkflow,
  removeViewLink,
  viewContentOf,
  viewLinkUrl,
  type ViewLink,
} from '@/backend/view-links';
import { Badge } from '@/components/badge';
import { PrimaryButton } from '@/components/primary-button';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useShownForm, type LinkedWorkflow } from '@/data/form-store';
import { getProcess } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';
import { getT, useT } from '@/i18n';
import type { FormTemplate } from '@/import/tableau';
import { confirmAction } from '@/utils/confirm';
import { shareLink } from '@/utils/share-link';

/**
 * « Partager par lien » : crée un lien de consultation pour le formulaire
 * affiché (et son workflow) ou pour un process, puis l'envoie. La personne
 * l'ouvre sans compte (page `voir/[jeton]`). En bas, ses liens : envoyer,
 * prolonger (30 jours), retirer.
 *
 * Paramètres : `source=form` (le formulaire affiché) ou `source=process&id=…`.
 */
export default function ShareViewLinkScreen() {
  const { source, id } = useLocalSearchParams<{ source?: string; id?: string }>();
  const theme = useTheme();
  const t = useT();
  const v = t.viewLink;
  const insets = useSafeAreaInsets();
  const session = useSession();
  const shown = useShownForm();

  let form: FormTemplate | null = null;
  let workflow: LinkedWorkflow | null = null;
  let defaultTitle = '';
  if (source === 'form' && shown) {
    form = shown.form;
    workflow = shown.workflow;
    defaultTitle = shown.form.name ?? t.form.unnamed;
  } else if (source === 'process' && id) {
    const process = getProcess(id);
    if (process) {
      workflow = processWorkflow(process);
      defaultTitle = process.name;
    }
  }
  const built = viewContentOf(form, workflow);

  const [title, setTitle] = useState(defaultTitle);
  const [note, setNote] = useState('');
  const [links, setLinks] = useState<ViewLink[] | null>(null);
  const [created, setCreated] = useState<ViewLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchLinks = useCallback(
    () =>
      listViewLinks().then(setLinks, (cause: unknown) =>
        setError(cause instanceof Error ? cause.message : getT().viewLink.readError),
      ),
    [],
  );
  useEffect(() => {
    if (session) fetchLinks();
  }, [session, fetchLinks]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : v.makeError);
    } finally {
      setBusy(null);
    }
  };

  const create = () =>
    run('create', async () => {
      const link = await createViewLink({ title: title.trim() || defaultTitle, note, form, workflow });
      setCreated(link);
      setLinks((list) => [link, ...(list ?? [])]);
    });
  const send = (link: ViewLink) =>
    run(link.id, async () => {
      const url = viewLinkUrl(link.token);
      const done = await shareLink(v.message(link.title, url), url);
      setNotice(done === 'copié' ? v.copied : v.sent);
    });
  const extend = (link: ViewLink) =>
    run(link.id, async () => {
      const expiresAt = await extendViewLink(link.id);
      setLinks((list) => (list ?? []).map((item) => (item.id === link.id ? { ...item, expiresAt } : item)));
      setNotice(v.extended);
    });
  const remove = (link: ViewLink) =>
    confirmAction(
      v.removeTitle,
      v.removeText(link.title),
      t.common.remove,
      () =>
        run(link.id, async () => {
          await removeViewLink(link.id);
          setLinks((list) => (list ?? []).filter((item) => item.id !== link.id));
          if (created?.id === link.id) setCreated(null);
        }),
      t.common.cancel,
    );

  if (session === null) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'person.crop.circle', android: 'account_circle' }}
          tone="primary"
          title={v.shareTitle}
          message={v.signIn}
          action={{ label: v.signInButton, onPress: () => router.push('/connexion') }}
        />
      </View>
    );
  }

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  const input = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
      <ThemedText themeColor="textSecondary">{v.shareIntro}</ThemedText>

      {built ? (
        <View style={[card, styles.padded]}>
          <View style={styles.row}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.flex}>
              {v.what}
            </ThemedText>
            <Badge label={v.kinds[built.kind]} />
          </View>
          <ThemedText type="smallBold" nativeID="titre">
            {v.titleLabel}
          </ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            accessibilityLabelledBy="titre"
            accessibilityLabel={v.titleLabel}
            maxLength={200}
            style={input}
          />
          <ThemedText type="smallBold" nativeID="mot">
            {v.noteLabel}
          </ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            accessibilityLabelledBy="mot"
            accessibilityLabel={v.noteLabel}
            placeholder={v.notePlaceholder}
            placeholderTextColor={theme.textSecondary}
            maxLength={1000}
            multiline
            style={[input, styles.multiline]}
          />
          <View style={[styles.notice, { backgroundColor: theme.warningBackground }]}>
            <SymbolView name={{ ios: 'exclamationmark.triangle', android: 'warning' }} size={18} tintColor={theme.warning} />
            <ThemedText type="small" style={styles.flex}>
              {v.warning} {v.copyNote}
            </ThemedText>
          </View>
          {busy === 'create' ? (
            <ActivityIndicator color={theme.textSecondary} />
          ) : (
            <PrimaryButton label={v.create} onPress={create} />
          )}
        </View>
      ) : (
        <ThemedText themeColor="textSecondary">{v.nothing}</ThemedText>
      )}

      {error && (
        <View style={[styles.message, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        </View>
      )}
      {notice && (
        <View style={[styles.message, { backgroundColor: theme.successBackground }]} accessibilityLiveRegion="polite">
          <ThemedText type="small" style={{ color: theme.success }}>
            {notice}
          </ThemedText>
        </View>
      )}

      {created && (
        <View style={[card, styles.padded, { borderColor: theme.primary, borderWidth: 1 }]}>
          <View style={styles.row}>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} tintColor={theme.success} />
            <ThemedText type="smallBold">{v.created}</ThemedText>
          </View>
          <ThemedText selectable type="small">
            {viewLinkUrl(created.token)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {v.expiresOn(new Date(created.expiresAt))}
          </ThemedText>
          <PrimaryButton label={v.send} onPress={() => send(created)} />
          <Pressable onPress={() => Linking.openURL(viewLinkUrl(created.token))} accessibilityRole="link" style={styles.secondary}>
            <ThemedText type="link" style={{ color: theme.link }}>
              {v.open}
            </ThemedText>
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
          {v.myLinks}
        </ThemedText>
        <View style={[card, styles.list]}>
          {links === null ? (
            <View style={styles.item}>
              <ActivityIndicator color={theme.textSecondary} />
            </View>
          ) : links.length === 0 ? (
            <View style={styles.item}>
              <ThemedText type="small" themeColor="textSecondary">
                {v.noLinks}
              </ThemedText>
            </View>
          ) : (
            links.map((link, index) => {
              const expired = isLinkExpired(link);
              return (
                <View
                  key={link.id}
                  style={[styles.item, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{link.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={expired ? { color: theme.danger } : undefined}>
                      {v.kinds[link.kind]} ·{' '}
                      {expired ? v.expiredOn(new Date(link.expiresAt)) : v.expiresOn(new Date(link.expiresAt))}
                    </ThemedText>
                  </View>
                  {busy === link.id ? (
                    <ActivityIndicator color={theme.textSecondary} />
                  ) : (
                    <View style={styles.actions}>
                      {linkNeedsExtension(link) && (
                        <Pressable onPress={() => extend(link)} accessibilityRole="button" hitSlop={8}>
                          <ThemedText type="smallBold" style={{ color: theme.link }}>
                            {v.extend}
                          </ThemedText>
                        </Pressable>
                      )}
                      {!expired && (
                        <Pressable onPress={() => send(link)} accessibilityRole="button" hitSlop={8}>
                          <ThemedText type="smallBold" style={{ color: theme.link }}>
                            {v.send}
                          </ThemedText>
                        </Pressable>
                      )}
                      <Pressable onPress={() => remove(link)} accessibilityRole="button" hitSlop={8}>
                        <ThemedText type="smallBold" style={{ color: theme.danger }}>
                          {t.common.remove}
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: 'center', padding: Spacing.four },
  flex: { flex: 1 },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: Radius.large, overflow: 'hidden' },
  padded: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { minHeight: 48, borderRadius: Radius.medium, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 16 },
  multiline: { minHeight: 88, paddingTop: Spacing.two, textAlignVertical: 'top' },
  notice: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.medium },
  message: { padding: Spacing.three, borderRadius: Radius.large },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  list: { paddingHorizontal: Spacing.three },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56, paddingVertical: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.three },
});
