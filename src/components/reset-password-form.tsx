import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { requestPasswordReset } from '@/backend/auth';
import { checkEmail, recoveryWebUrl } from '@/backend/auth-messages';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** Adresse où le lien de l'e-mail rouvre l'app (simuflow://nouveau-mot-de-passe sur le téléphone). */
export const RECOVERY_PATH = 'nouveau-mot-de-passe';

/**
 * Sur le téléphone : simuflow://nouveau-mot-de-passe. Sur le web : l'adresse du site
 * avec son sous-dossier (https://mloick.github.io/SIMUFLOW/app/nouveau-mot-de-passe).
 */
function recoveryUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return recoveryWebUrl(window.location.origin, Constants.expoConfig?.experiments?.baseUrl, RECOVERY_PATH);
  }
  return Linking.createURL(RECOVERY_PATH);
}

/**
 * Mot de passe oublié, étape 1 : l'adresse. Supabase envoie un e-mail avec un
 * lien ; ouvert sur le téléphone, il rouvre l'app sur l'écran « Nouveau mot de passe ».
 */
export function ResetPasswordForm({ initialEmail, onCancel }: { initialEmail: string; onCancel: () => void }) {
  const theme = useTheme();
  const t = useT();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const problem = checkEmail(email);
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await requestPasswordReset(email, recoveryUrl());
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSent(true);
  };

  return (
    <View style={styles.form}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {sent ? t.signIn.checkMail : t.reset.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{sent ? t.reset.sent(email.trim()) : t.reset.intro}</ThemedText>

      {!sent && (
        <View style={styles.field}>
          <ThemedText type="smallBold">{t.common.emailLabel}</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t.common.emailPlaceholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.common.emailLabel}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={send}
            editable={!busy}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder },
            ]}
          />
        </View>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      {busy ? (
        <ActivityIndicator color={theme.primary} style={styles.busy} accessibilityLabel={t.common.sending} />
      ) : sent ? (
        <PrimaryButton label={t.reset.resend} onPress={() => setSent(false)} />
      ) : (
        <PrimaryButton label={t.reset.send} onPress={send} />
      )}

      <Pressable
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
        <ThemedText type="link">{t.reset.back}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  busy: { minHeight: 48 },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
