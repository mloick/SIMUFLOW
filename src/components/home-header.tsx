import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { HelpSheet } from '@/components/help-button';
import { PressableScale } from '@/components/pressable-scale';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useMyProfile } from '@/data/profile-store';
import { useShareAlerts } from '@/data/share-alerts-store';
import { displayName } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/utils/initials';
import { useT } from '@/i18n';

/**
 * En-tête de l'accueil (refonte) : l'avatar et « Bonjour » ouvrent la page
 * Profil ; le bouton « ? » explique l'app en trois étapes ; la cloche ouvre les
 * alertes du partage, avec le nombre de nouvelles en pastille.
 */
export function HomeHeader() {
  const theme = useTheme();
  const t = useT();
  const session = useSession();
  const state = useMyProfile();
  const { unread } = useShareAlerts();
  const [helpOpen, setHelpOpen] = useState(false);
  const profile = state.status === 'ready' ? state.profile : null;
  const name = session ? (profile ? displayName(profile) : (session.user.email ?? '')) : t.list.guest;

  return (
    <View style={styles.row}>
      <PressableScale
        onPress={() => router.push('/profil')}
        accessibilityRole="button"
        accessibilityLabel={`${t.list.hello} ${name}`}
        accessibilityHint={t.list.openProfile}
        style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          {session ? (
            <ThemedText style={[styles.avatarText, { color: theme.onPrimary }]} maxFontSizeMultiplier={1.2}>
              {initials(name)}
            </ThemedText>
          ) : (
            <SymbolView name={{ ios: 'person.fill', android: 'person' }} size={22} tintColor={theme.onPrimary} />
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t.list.hello}
          </ThemedText>
          <ThemedText style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
        </View>
      </PressableScale>
      <RoundButton
        icon={{ ios: 'questionmark.circle', android: 'help' }}
        label={t.list.helpTitle}
        onPress={() => setHelpOpen(true)}
      />
      <View>
        <RoundButton
          icon={{ ios: 'bell', android: 'notifications' }}
          label={t.list.alerts(unread)}
          onPress={() => router.push('/alertes')}
        />
        {unread > 0 && (
          <View
            style={[styles.dot, { backgroundColor: theme.danger, borderColor: theme.background }]}
            pointerEvents="none">
            <ThemedText style={[styles.dotText, { color: theme.background }]} maxFontSizeMultiplier={1.2}>
              {unread > 9 ? '9+' : unread}
            </ThemedText>
          </View>
        )}
      </View>
      <HelpSheet
        visible={helpOpen}
        title={t.list.helpTitle}
        text={t.list.helpText}
        onClose={() => setHelpOpen(false)}
      />
    </View>
  );
}

/** Bouton rond de 44 points, icône seule (son nom est lu par VoiceOver). */
function RoundButton({ icon, label, onPress }: { icon: SymbolViewProps['name']; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
      <SymbolView name={icon} size={21} tintColor={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  profile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 800,
  },
  flex: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 800,
  },
});
