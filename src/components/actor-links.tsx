import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { createActorLink, linkUrl, listActorLinks, removeActorLink, type ActorLink } from '@/backend/links';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { shareLink } from '@/utils/share-link';

/**
 * « Liens pour les acteurs sans compte » : un lien web par acteur du schéma.
 * La personne l'ouvre dans son navigateur, confirme son nom et relit sa
 * partie. Créer, envoyer, retirer.
 */
export function ActorLinks({
  cloudId,
  processName,
  actors,
}: {
  cloudId: string;
  processName: string;
  actors: string[];
}) {
  const theme = useTheme();
  const [links, setLinks] = useState<ActorLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchLinks = useCallback(
    () =>
      listActorLinks(cloudId).then(setLinks, (cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Les liens n’ont pas pu être lus.'),
      ),
    [cloudId],
  );

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const run = async (actor: string, action: () => Promise<void>) => {
    setBusy(actor);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le lien n’a pas pu être fait.');
    } finally {
      setBusy(null);
    }
  };

  const send = (link: ActorLink) =>
    run(link.actor, async () => {
      const url = linkUrl(link.token);
      const done = await shareLink(
        `Pouvez-vous relire votre partie (« ${link.actor} ») du process « ${processName} » ? Pas besoin de compte : ${url}`,
        url,
      );
      setNotice(done === 'copié' ? `Lien de « ${link.actor} » copié.` : `Lien de « ${link.actor} » envoyé.`);
    });

  const create = (actor: string) =>
    run(actor, async () => {
      const link = await createActorLink(cloudId, actor);
      setLinks((list) => [...(list ?? []), link]);
    });

  const remove = (link: ActorLink) =>
    confirmAction(
      'Retirer ce lien ?',
      `Le lien de « ${link.actor} » ne s’ouvrira plus, et les avis donnés par ce lien seront retirés.`,
      'Retirer',
      () =>
        run(link.actor, async () => {
          await removeActorLink(link.id);
          setLinks((list) => (list ?? []).filter((item) => item.id !== link.id));
        }),
    );

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Liens pour les acteurs sans compte
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Un lien par acteur, à envoyer à la bonne personne : elle l’ouvre dans son navigateur, confirme son nom et relit
        sa partie, sans créer de compte.
      </ThemedText>
      {error && (
        <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        </View>
      )}
      {notice && (
        <View style={[styles.notice, { backgroundColor: theme.successBackground }]} accessibilityLiveRegion="polite">
          <ThemedText type="small" style={{ color: theme.success }}>
            {notice}
          </ThemedText>
        </View>
      )}
      {links === null ? (
        <View style={[card, styles.row]}>
          {error ? (
            <Pressable onPress={fetchLinks} accessibilityRole="button">
              <ThemedText type="link">Réessayer</ThemedText>
            </Pressable>
          ) : (
            <ActivityIndicator color={theme.textSecondary} />
          )}
        </View>
      ) : (
        <View style={card}>
          {actors.map((actor, index) => {
            const link = links.find((item) => item.actor === actor);
            return (
              <View
                key={actor}
                style={[
                  styles.actor,
                  index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}>
                <View style={styles.flex}>
                  <ThemedText>{actor}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {link ? linkUrl(link.token).replace('https://', '') : 'Pas de lien'}
                  </ThemedText>
                </View>
                {busy === actor ? (
                  <ActivityIndicator color={theme.textSecondary} />
                ) : link ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => send(link)}
                      accessibilityRole="button"
                      accessibilityLabel={`Envoyer le lien de ${actor}`}
                      hitSlop={8}>
                      <ThemedText type="smallBold" style={{ color: theme.link }}>
                        Envoyer
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => remove(link)}
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer le lien de ${actor}`}
                      hitSlop={8}>
                      <ThemedText type="smallBold" style={{ color: theme.danger }}>
                        Retirer
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => create(actor)}
                    accessibilityRole="button"
                    accessibilityLabel={`Créer un lien pour ${actor}`}
                    hitSlop={8}>
                    <ThemedText type="smallBold" style={{ color: theme.link }}>
                      Créer un lien
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  flex: { flex: 1, gap: Spacing.half },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three },
  row: { minHeight: 48, paddingVertical: Spacing.three, alignItems: 'flex-start' },
  notice: { padding: Spacing.three, borderRadius: Radius.medium },
  actor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
  actions: { flexDirection: 'row', gap: Spacing.three },
});
