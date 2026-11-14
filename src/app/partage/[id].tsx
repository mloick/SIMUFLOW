import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { SharePanel } from '@/components/share-panel';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { syncNow } from '@/data/cloud-sync';
import { getProcess, isImported, useCloudId } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';

/**
 * « Partager » : inviter des membres sur un process, par leur identifiant ou
 * leur adresse e-mail, en reliant chacun à un acteur du schéma. Les membres
 * peuvent lire le process depuis leur compte, pas le modifier.
 */
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const session = useSession();
  const process = getProcess(id);
  const cloudId = useCloudId(id);

  let body;
  if (!process) {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title="Process introuvable"
        message="Ce process n’existe plus sur ce téléphone."
        action={{ label: 'Revenir', onPress: () => router.back() }}
      />
    );
  } else if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title="Connexion requise"
        message="Pour partager un process, il doit être sur votre compte : connectez-vous d’abord."
        action={{ label: 'Se connecter', onPress: () => router.push('/connexion') }}
      />
    );
  } else if (!isImported(process.id)) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title="Exemple non partageable"
        message="Les exemples fournis avec l’app ne se partagent pas. Importez votre propre process pour le partager."
        action={{ label: 'Revenir', onPress: () => router.back() }}
      />
    );
  } else if (!cloudId) {
    body = (
      <StateMessage
        icon={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload' }}
        tone="primary"
        title="Pas encore sur votre compte"
        message="Le process doit d’abord être envoyé sur votre compte. Il le sera à la prochaine synchronisation."
        action={{ label: 'Synchroniser maintenant', onPress: () => syncNow() }}
      />
    );
  } else {
    body = <SharePanel process={process} cloudId={cloudId} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Partager',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>Fermer</ThemedText>
            </Pressable>
          ),
        }}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
