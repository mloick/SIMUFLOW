import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { type AuthResult, openRecoveryLink, updatePassword } from '@/backend/auth';
import { checkNewPassword, parseRecoveryLink } from '@/backend/auth-messages';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Mot de passe oublié, étape 2 : l'écran que rouvre le lien de l'e-mail
 * (simuflow://nouveau-mot-de-passe#access_token=…). Le lien ouvre une session
 * sur le compte ; l'utilisateur choisit alors un nouveau mot de passe.
 */
export default function NewPasswordScreen() {
  const theme = useTheme();
  const t = useT();
  const url = Linking.useLinkingURL();
  const link = useMemo(() => parseRecoveryLink(url), [url]);
  const [opened, setOpened] = useState<AuthResult | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (link?.kind !== 'session') return;
    let live = true;
    openRecoveryLink(link).then((result) => live && setOpened(result));
    return () => {
      live = false;
    };
  }, [link]);

  const save = async () => {
    const problem = checkNewPassword(password);
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setDone(true);
  };

  // Le lien est invalide, expiré, ou la session n'a pas pu s'ouvrir.
  const linkProblem =
    link === null
      ? t.newPassword.invalidLink
      : link.kind === 'error'
        ? link.message
        : opened && !opened.ok
          ? opened.message
          : null;

  let content;
  if (done) {
    content = (
      <>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t.newPassword.done}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t.newPassword.doneText}</ThemedText>
        <PrimaryButton label={t.newPassword.continue} onPress={() => router.replace('/profil')} />
      </>
    );
  } else if (linkProblem) {
    content = (
      <>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t.newPassword.unusable}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{linkProblem}</ThemedText>
        <PrimaryButton label={t.newPassword.askNew} onPress={() => router.replace('/connexion')} />
      </>
    );
  } else if (!opened) {
    content = (
      <ActivityIndicator color={theme.primary} style={styles.busy} accessibilityLabel={t.newPassword.opening} />
    );
  } else {
    content = (
      <>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t.newPassword.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t.newPassword.intro}</ThemedText>
        <View style={styles.field}>
          <ThemedText type="smallBold">{t.newPassword.title}</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t.newPassword.title}
            accessibilityHint={t.auth.passwordRule}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={save}
            editable={!busy}
            autoFocus
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t.auth.passwordRule}
          </ThemedText>
        </View>
        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        )}
        {busy ? (
          <ActivityIndicator color={theme.primary} style={styles.busy} accessibilityLabel={t.common.sending} />
        ) : (
          <PrimaryButton label={t.newPassword.save} onPress={save} />
        )}
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  busy: { minHeight: 48 },
});
