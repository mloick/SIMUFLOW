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
import { splitExamples } from '@/data/examples';
import { useProcessList } from '@/data/process-list';
import { summarize, type Process, type ProcessSummary } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { normalizeForSearch } from '@/utils/format';

const NO_PROCESSES: Process[] = [];

/** Une ligne de la liste : une carte, le titre repliable « Exemples », ou l'invitation à ajouter un process. */
type Row =
  | { kind: 'card'; process: Process; summary: ProcessSummary }
  | { kind: 'examples'; count: number }
  | { kind: 'hint' };

/**
 * Liste des process (maquette, écran 2) et ses 5 états : chargement, vide,
 * erreur, hors connexion et contenu.
 */
export default function ProcessListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const list = useProcessList();
  const [query, setQuery] = useState('');
  const [examplesOpen, setExamplesOpen] = useState(true);
  const reduceMotion = useReducedMotion();

  const processes = list.status === 'ready' ? list.processes : NO_PROCESSES;
  // Vos process d'abord, puis les exemples fournis avec l'app, dans une section repliable.
  const rows = useMemo(() => {
    const search = normalizeForSearch(query);
    const card = (process: Process): Row => ({ kind: 'card', process, summary: summarize(process) });
    const matches = processes.filter((process) => normalizeForSearch(process.name).includes(search));
    const { own, examples } = splitExamples(matches);
    const result: Row[] = own.map(card);
    if (own.length === 0 && !search && examples.length > 0) result.push({ kind: 'hint' });
    if (examples.length > 0) {
      result.push({ kind: 'examples', count: examples.length });
      if (examplesOpen) result.push(...examples.map(card));
    }
    return result;
  }, [processes, query, examplesOpen]);

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
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search' }} size={20} tintColor={theme.textSecondary} />
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
        data={rows}
        keyExtractor={(row) => (row.kind === 'card' ? row.process.id : row.kind)}
        renderItem={({ item: row, index }) => {
          if (row.kind === 'hint') {
            return (
              <View style={[styles.hint, { borderColor: theme.fieldBorder }]}>
                <ThemedText themeColor="textSecondary">
                  Vos process apparaîtront ici. Touchez + pour en importer un ou scanner un tableau, ou essayez d’abord
                  les exemples ci-dessous.
                </ThemedText>
              </View>
            );
          }
          if (row.kind === 'examples') {
            return (
              <Pressable
                onPress={() => setExamplesOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: examplesOpen }}
                accessibilityLabel={`Exemples, ${row.count} process`}
                accessibilityHint={examplesOpen ? 'Replie les exemples' : 'Affiche les exemples'}
                style={styles.examplesHeader}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
                    Exemples · {row.count}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Fournis avec l’app, pour essayer. Masquez-les dans le Profil.
                  </ThemedText>
                </View>
                <SymbolView
                  name={
                    examplesOpen
                      ? { ios: 'chevron.up', android: 'expand_less' }
                      : { ios: 'chevron.down', android: 'expand_more' }
                  }
                  size={18}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            );
          }
          return (
            // Les cartes arrivent l'une après l'autre en glissant vers le haut ;
            // rien ne bouge si « Réduire les animations » est activé.
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(index * 60).duration(300)}>
              <ProcessCard process={row.process} summary={row.summary} />
            </Animated.View>
          );
        }}
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
  flex: {
    flex: 1,
  },
  hint: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  examplesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    marginTop: Spacing.two,
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
