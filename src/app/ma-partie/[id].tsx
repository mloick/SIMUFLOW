import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { ReviewPanel } from '@/components/review-panel';
import { StateMessage } from '@/components/state-message';
import { useShared } from '@/data/shared-store';
import { useTheme } from '@/hooks/use-theme';

/**
 * « Ma partie » : le membre d'un process partagé relit ses étapes et donne son
 * avis sur chacune (validée, ou à revoir avec un commentaire).
 */
export default function MyPartScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const session = useSession();
  const shared = useShared(id);

  let body;
  if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title="Connexion requise"
        message="Vos avis sont gardés sur votre compte : connectez-vous d’abord."
        action={{ label: 'Se connecter', onPress: () => router.push('/connexion') }}
      />
    );
  } else if (!shared) {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title="Process plus partagé"
        message="Ce process n’est plus partagé avec vous : son propriétaire l’a retiré ou supprimé."
        action={{ label: 'Revenir', onPress: () => router.back() }}
      />
    );
  } else {
    body = <ReviewPanel shared={shared} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Ma partie',
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
});
