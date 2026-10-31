import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { requestPasswordReset } from '@/backend/auth';
import { checkEmail } from '@/backend/auth-messages';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Adresse où le lien de l'e-mail rouvre l'app (simuflow://nouveau-mot-de-passe sur le téléphone). */
export const RECOVERY_PATH = 'nouveau-mot-de-passe';

/**
 * Mot de passe oublié, étape 1 : l'adresse. Supabase envoie un e-mail avec un
 * lien ; ouvert sur le téléphone, il rouvre l'app sur l'écran « Nouveau mot de passe ».
 */
export function ResetPasswordForm({ initialEmail, onCancel }: { initialEmail: string; onCancel: () => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const problem = checkEmail(email);
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await requestPasswordReset(email, Linking.createURL(RECOVERY_PATH));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSent(true);
  };

  return (
    <View style={styles.form}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {sent ? 'Vérifiez vos e-mails' : 'Mot de passe oublié'}
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        {sent
          ? `Si un compte existe pour ${email.trim()}, un e-mail vient de lui être envoyé. Ouvrez le lien qu'il contient sur ce téléphone : SimuFlow s'ouvrira pour choisir un nouveau mot de passe. Le lien est valable une heure.`
          : 'Saisissez votre adresse : vous recevrez un lien par e-mail pour choisir un nouveau mot de passe.'}
      </ThemedText>

      {!sent && (
        <View style={styles.field}>
          <ThemedText type="smallBold">Adresse e-mail</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="prenom.nom@exemple.fr"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Adresse e-mail"
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
        <ActivityIndicator color={theme.primary} style={styles.busy} accessibilityLabel="Envoi en cours" />
      ) : sent ? (
        <PrimaryButton label="Renvoyer un e-mail" onPress={() => setSent(false)} />
      ) : (
        <PrimaryButton label="Recevoir un lien" onPress={send} />
      )}

      <Pressable
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
        <ThemedText type="link">Retour à la connexion</ThemedText>
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
