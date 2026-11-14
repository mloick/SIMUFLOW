import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { markShareAlertsSeen, useShareAlerts } from '@/data/share-alerts-store';
import type { ShareAlert } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { formatMoment } from '@/tracking/format';
import { useT } from '@/i18n';

const ICONS = {
  partage: { ios: 'person.2', android: 'group' },
  a_revoir: { ios: 'exclamationmark.bubble', android: 'feedback' },
  valide: { ios: 'checkmark.seal', android: 'verified' },
} as const;

/**
 * « Alertes » : ce que le partage a apporté depuis les dernières
 * synchronisations (nouveau partage, étape à revoir, process validé). Les
 * mêmes alertes arrivent en notification sur le téléphone. Ouvrir l'écran
 * les marque comme vues.
 */
export default function AlertsScreen() {
  const theme = useTheme();
  const t = useT();
  const { alerts } = useShareAlerts();

  useEffect(() => {
    markShareAlertsSeen();
  }, [alerts]);

  const open = (alert: ShareAlert) => router.push({ pathname: alert.target.pathname, params: { id: alert.target.id } });

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.alerts,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
        }}
      />
      <FlatList
        data={alerts}
        keyExtractor={(alert) => alert.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <StateMessage
            icon={{ ios: 'bell', android: 'notifications' }}
            tone="primary"
            title={t.alerts.empty}
            message={t.alerts.emptyText}
            action={{ label: t.share.back, onPress: () => router.back() }}
          />
        }
        renderItem={({ item: alert }) => (
          <Pressable
            onPress={() => open(alert)}
            accessibilityRole="button"
            accessibilityLabel={`${alert.title}. ${alert.body}`}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
            ]}>
            <SymbolView
              name={ICONS[alert.kind]}
              size={22}
              tintColor={
                alert.kind === 'a_revoir' ? theme.warning : alert.kind === 'valide' ? theme.success : theme.link
              }
            />
            <View style={styles.text}>
              <ThemedText type="smallBold">{alert.title}</ThemedText>
              <ThemedText type="small">{alert.body}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoment(alert.at, t)}
              </ThemedText>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right' }}
              size={16}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: Spacing.half },
});
