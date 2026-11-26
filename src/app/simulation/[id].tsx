import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Simulator } from '@/components/simulator';
import { StateMessage } from '@/components/state-message';
import { getProcess } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Simulation (refonte R9 à R11) : on rejoue le process étape par étape. Le
 * schéma montre tout le process (les étapes à venir en transparence) et suit
 * l'étape en cours (« Suivi auto ») tant qu'on ne le déplace pas au doigt. La
 * carte d'étape en bas donne le genre, les jours cumulés et les choix côte à
 * côte. « Simple » et « Complexe » rejouent le chemin le plus court et le plus
 * long ; « Tous » montre tous les chemins, une couleur par famille.
 * Plein écran : le schéma prend l'écran et la carte flotte. Téléphone tourné :
 * schéma à gauche, carte à droite.
 */
export default function SimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const process = getProcess(id);
  const theme = useTheme();
  const t = useT();

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title={t.detail.notFound}
          message={t.simulation.notFoundText}
          action={{ label: t.simulation.back, onPress: () => router.back() }}
        />
      </View>
    );
  }

  return <Simulator process={process} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
