import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { ReviewPanel } from '@/components/review-panel';
import { StateMessage } from '@/components/state-message';
import { useShared } from '@/data/shared-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * « Ma partie » : le membre d'un process partagé relit ses étapes et donne son
 * avis sur chacune (validée, ou à revoir avec un commentaire).
 */
export default function MyPartScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const t = useT();
  const session = useSession();
  const shared = useShared(id);

  let body;
  if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.2', android: 'group' }}
        tone="primary"
        title={t.share.signInRequired}
        message={t.review.signInText}
        action={{ label: t.share.signIn, onPress: () => router.push('/connexion') }}
      />
    );
  } else if (!shared) {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title={t.review.notShared}
        message={t.review.notSharedText}
        action={{ label: t.share.back, onPress: () => router.back() }}
      />
    );
  } else {
    body = <ReviewPanel shared={shared} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.myPart,
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
