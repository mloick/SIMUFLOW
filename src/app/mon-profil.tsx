import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/backend/auth';
import { ProfileForm } from '@/components/profile-form';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { updateMyProfile, useMyProfile } from '@/data/profile-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * « Mon profil » : prénom, nom, identifiant et rôle du compte connecté. Le
 * profil est gardé sur le serveur ; l'identifiant servira à être invité sur
 * un process.
 */
export default function MyProfileScreen() {
  const theme = useTheme();
  const t = useT();
  const session = useSession();
  const state = useMyProfile();

  let body;
  if (session === null) {
    body = (
      <StateMessage
        icon={{ ios: 'person.crop.circle', android: 'account_circle' }}
        tone="primary"
        title={t.myProfile.signInRequired}
        message={t.myProfile.signInRequiredText}
        action={{ label: t.common.signIn, onPress: () => router.replace('/connexion') }}
      />
    );
  } else if (state.status === 'error') {
    body = (
      <StateMessage
        icon={{ ios: 'exclamationmark.circle', android: 'error' }}
        tone="danger"
        title={t.myProfile.unavailable}
        message={state.message}
        action={{ label: t.common.retry, onPress: state.reload }}
      />
    );
  } else if (state.status !== 'ready') {
    body = null;
  } else {
    body = (
      <ProfileForm
        initial={state.profile}
        onSave={async (profile) => {
          await updateMyProfile(profile);
          router.back();
        }}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.myProfile,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>{t.common.cancel}</ThemedText>
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
