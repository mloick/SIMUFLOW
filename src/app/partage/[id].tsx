import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { SharePanel } from '@/components/share-panel';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { syncNow } from '@/data/cloud-sync';
import { getProcess, isImported, useCloudId } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * « Partager » : inviter des membres sur un process, par leur identifiant ou
 * leur adresse e-mail, en reliant chacun à un acteur du schéma. Les membres
 * peuvent lire le process depuis leur compte, pas le modifier.
 */
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const t = useT();
  const s = t.share;
  const session = useSession();
  const process = getProcess(id);
  const cloudId = useCloudId(id);

  let body;
  if (!process) {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title={s.notFound}
        message={s.notFoundText}
        action={{ label: s.back, onPress: () => router.back() }}
      />
    );
  } else if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title={s.signInRequired}
        message={s.signInText}
        action={{ label: s.signIn, onPress: () => router.push('/connexion') }}
      />
    );
  } else if (!isImported(process.id)) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title={s.example}
        message={s.exampleText}
        action={{ label: s.back, onPress: () => router.back() }}
      />
    );
  } else if (!cloudId) {
    body = (
      <StateMessage
        icon={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload' }}
        tone="primary"
        title={s.notOnAccount}
        message={s.notOnAccountText}
        action={{ label: s.syncNow, onPress: () => syncNow() }}
      />
    );
  } else {
    body = <SharePanel process={process} cloudId={cloudId} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.share,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>{s.close}</ThemedText>
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
