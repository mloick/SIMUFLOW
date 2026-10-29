import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/list-skeleton';
import { ProcessCard } from '@/components/process-card';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProcessList } from '@/data/process-store';
import { summarize, type Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { normalizeForSearch } from '@/utils/format';

const NO_PROCESSES: Process[] = [];

/**
 * Liste des process (maquette, écran 2) et ses 5 états : chargement, vide,
 * erreur, hors connexion et contenu.
 */
export default function ProcessListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const list = useProcessList();
  const [query, setQuery] = useState('');
  const reduceMotion = useReducedMotion();

  const processes = list.status === 'ready' ? list.processes : NO_PROCESSES;
  const items = useMemo(() => {
    const search = normalizeForSearch(query);
    return processes
      .filter((process) => normalizeForSearch(process.name).includes(search))
      .map((process) => ({ process, summary: summarize(process) }));
  }, [processes, query]);

  const openImport = () => router.push('/import');
  const hasProcesses = processes.length > 0;

  const header = (
    <View style={styles.header}>
      <ThemedText type="title" accessibilityRole="header">
        Process
      </ThemedText>
      {list.status === 'loading' && <View style={[styles.search, { backgroundColor: theme.field }]} />}
      {list.status === 'ready' && hasProcesses && (
        <View style={[styles.search, { backgroundColor: theme.field }]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search' }}
            size={20}
            tintColor={theme.textSecondary}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un process"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Rechercher un process"
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
      )}
      {list.status === 'ready' && list.offline && (
        <View style={[styles.offline, { backgroundColor: theme.warningBackground }]} accessibilityRole="alert">
          <SymbolView name={{ ios: 'wifi.slash', android: 'wifi_off' }} size={18} tintColor={theme.warning} />
          <ThemedText type="small" style={[styles.offlineText, { color: theme.warning }]}>
            Hors connexion. Vous voyez la dernière version enregistrée.
          </ThemedText>
        </View>
      )}
    </View>
  );

  let empty;
  if (list.status === 'loading') {
    empty = <ListSkeleton />;
  } else if (list.status === 'error') {
    empty = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title="Impossible de charger vos process"
        message="Le serveur n’a pas répondu. Vos données ne sont pas perdues."
        action={{ label: 'Réessayer', onPress: list.reload }}
      />
    );
  } else if (!hasProcesses) {
    empty = (
      <StateMessage
        icon={{ ios: 'list.bullet.rectangle', android: 'account_tree' }}
        tone="primary"
        title="Aucun process pour l’instant"
        message="Importez un fichier draw.io ou scannez un tableau pour commencer."
        action={{ label: 'Ajouter un process', onPress: openImport }}
      />
    );
  } else {
    empty = (
      <ThemedText themeColor="textSecondary" style={styles.noResult}>
        Aucun process ne correspond à « {query.trim()} ».
      </ThemedText>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.process.id}
        renderItem={({ item, index }) => (
          // Les cartes arrivent l'une après l'autre en glissant vers le haut ;
          // rien ne bouge si « Réduire les animations » est activé.
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(index * 60).duration(300)}>
            <ProcessCard process={item.process} summary={item.summary} />
          </Animated.View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
      />

      {list.status === 'ready' && hasProcesses && (
        <Pressable
          onPress={openImport}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un process"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.primary, bottom: insets.bottom + Spacing.three, opacity: pressed ? 0.85 : 1 },
          ]}>
          <SymbolView name={{ ios: 'plus', android: 'add' }} size={28} tintColor={theme.onPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three - Spacing.one,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: Spacing.two,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.small,
    padding: Spacing.three - Spacing.one,
  },
  offlineText: {
    flex: 1,
  },
  noResult: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(0, 126, 197, 0.35)',
  },
});
