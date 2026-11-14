import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { StateMessage } from '@/components/state-message';
import { ValidationPanel } from '@/components/validation-panel';
import { getProcess, isImported, useCloudId } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * « Suivi de la validation » : le propriétaire d'un process partagé voit où en
 * est chaque membre et ce qui est à revoir, étape par étape.
 */
export default function ValidationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const t = useT();
  const v = t.validationScreen;
  const session = useSession();
  const process = getProcess(id);
  const cloudId = useCloudId(id);

  let body;
  if (!process || !isImported(process.id)) {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title={t.share.notFound}
        message={v.notFoundText}
        action={{ label: t.share.back, onPress: () => router.back() }}
      />
    );
  } else if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title={t.share.signInRequired}
        message={v.signInText}
        action={{ label: t.share.signIn, onPress: () => router.push('/connexion') }}
      />
    );
  } else if (!cloudId) {
    body = (
      <StateMessage
        icon={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload' }}
        tone="primary"
        title={v.notShared}
        message={v.notSharedText}
        action={{ label: t.share.back, onPress: () => router.back() }}
      />
    );
  } else {
    body = <ValidationPanel process={process} cloudId={cloudId} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.validation,
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
