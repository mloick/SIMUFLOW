import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { StateMessage } from '@/components/state-message';
import { ValidationPanel } from '@/components/validation-panel';
import { getProcess, isImported, useCloudId } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';

/**
 * « Suivi de la validation » : le propriétaire d'un process partagé voit où en
 * est chaque membre et ce qui est à revoir, étape par étape.
 */
export default function ValidationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const session = useSession();
  const process = getProcess(id);
  const cloudId = useCloudId(id);

  let body;
  if (!process || !isImported(process.id)) {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title="Process introuvable"
        message="Seul le propriétaire d’un process suit sa validation, depuis le téléphone où il l’a importé."
        action={{ label: 'Revenir', onPress: () => router.back() }}
      />
    );
  } else if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title="Connexion requise"
        message="Les avis des membres sont sur votre compte : connectez-vous d’abord."
        action={{ label: 'Se connecter', onPress: () => router.push('/connexion') }}
      />
    );
  } else if (!cloudId) {
    body = (
      <StateMessage
        icon={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload' }}
        tone="primary"
        title="Pas encore partagé"
        message="Ce process n’est pas encore sur votre compte : partagez-le d’abord avec ses acteurs."
        action={{ label: 'Revenir', onPress: () => router.back() }}
      />
    );
  } else {
    body = <ValidationPanel process={process} cloudId={cloudId} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Suivi de la validation',
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
