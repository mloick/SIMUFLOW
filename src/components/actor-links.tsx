import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  createActorLink,
  extendActorLink,
  isLinkExpired,
  linkNeedsExtension,
  linkUrl,
  listActorLinks,
  removeActorLink,
  type ActorLink,
} from '@/backend/links';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { shareLink } from '@/utils/share-link';
import { getT, useT } from '@/i18n';

/**
 * « Liens pour les acteurs sans compte » : un lien web par acteur du schéma.
 * La personne l'ouvre dans son navigateur, confirme son nom et relit sa
 * partie. Créer, envoyer, prolonger (un lien vaut 30 jours), retirer.
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
  const t = useT();
  const l = t.share.links;
  const [links, setLinks] = useState<ActorLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchLinks = useCallback(
    () =>
      listActorLinks(cloudId).then(setLinks, (cause: unknown) =>
        setError(cause instanceof Error ? cause.message : getT().share.links.readError),
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
      setError(cause instanceof Error ? cause.message : l.makeError);
    } finally {
      setBusy(null);
    }
  };

  const send = (link: ActorLink) =>
    run(link.actor, async () => {
      const url = linkUrl(link.token);
      const done = await shareLink(l.message(link.actor, processName, url), url);
      setNotice(done === 'copié' ? l.copied(link.actor) : l.sent(link.actor));
    });

  const create = (actor: string) =>
    run(actor, async () => {
      const link = await createActorLink(cloudId, actor);
      setLinks((list) => [...(list ?? []), link]);
    });

  const extend = (link: ActorLink) =>
    run(link.actor, async () => {
      const expiresAt = await extendActorLink(link.id);
      setLinks((list) => (list ?? []).map((item) => (item.id === link.id ? { ...item, expiresAt } : item)));
      setNotice(l.extended(link.actor));
    });

  const remove = (link: ActorLink) =>
    confirmAction(
      l.removeTitle,
      l.removeText(link.actor),
      t.common.remove,
      () =>
        run(link.actor, async () => {
          await removeActorLink(link.id);
          setLinks((list) => (list ?? []).filter((item) => item.id !== link.id));
        }),
      t.common.cancel,
    );

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {l.heading}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {l.intro}
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
              <ThemedText type="link">{t.common.retry}</ThemedText>
            </Pressable>
          ) : (
            <ActivityIndicator color={theme.textSecondary} />
          )}
        </View>
      ) : (
        <View style={card}>
          {actors.map((actor, index) => {
            const link = links.find((item) => item.actor === actor);
            const expired = link ? isLinkExpired(link) : false;
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
                    {link ? linkUrl(link.token).replace('https://', '') : l.none}
                  </ThemedText>
                  {link?.expiresAt && (
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={expired ? { color: theme.danger } : undefined}>
                      {expired ? l.expiredOn(new Date(link.expiresAt)) : l.expiresOn(new Date(link.expiresAt))}
                    </ThemedText>
                  )}
                </View>
                {busy === actor ? (
                  <ActivityIndicator color={theme.textSecondary} />
                ) : link ? (
                  <View style={styles.actions}>
                    {linkNeedsExtension(link) && (
                      <Pressable
                        onPress={() => extend(link)}
                        accessibilityRole="button"
                        accessibilityLabel={l.extendLabel(actor)}
                        hitSlop={8}>
                        <ThemedText type="smallBold" style={{ color: theme.link }}>
                          {l.extend}
                        </ThemedText>
                      </Pressable>
                    )}
                    {/* Un lien expiré ne s'envoie plus : il faut d'abord le prolonger. */}
                    {!expired && (
                      <Pressable
                        onPress={() => send(link)}
                        accessibilityRole="button"
                        accessibilityLabel={l.sendLabel(actor)}
                        hitSlop={8}>
                        <ThemedText type="smallBold" style={{ color: theme.link }}>
                          {l.send}
                        </ThemedText>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => remove(link)}
                      accessibilityRole="button"
                      accessibilityLabel={l.removeLabel(actor)}
                      hitSlop={8}>
                      <ThemedText type="smallBold" style={{ color: theme.danger }}>
                        {t.common.remove}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => create(actor)}
                    accessibilityRole="button"
                    accessibilityLabel={l.createLabel(actor)}
                    hitSlop={8}>
                    <ThemedText type="smallBold" style={{ color: theme.link }}>
                      {l.create}
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
  card: { borderRadius: Radius.large, paddingHorizontal: Spacing.three },
  row: { minHeight: 48, paddingVertical: Spacing.three, alignItems: 'flex-start' },
  notice: { padding: Spacing.three, borderRadius: Radius.large },
  actor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
  actions: { flexDirection: 'row', gap: Spacing.three },
});
