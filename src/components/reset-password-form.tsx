import { type ComponentRef, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { requestPasswordReset, resetPassword } from '@/backend/auth';
import { checkEmail, checkPasswordReset, PASSWORD_MIN_LENGTH } from '@/backend/auth-messages';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Mot de passe oublié, en deux temps : l'adresse, pour recevoir un code par
 * e-mail ; puis le code et le nouveau mot de passe. Pas de lien à ouvrir :
 * le code se tape dans l'app, même si l'e-mail est lu sur un autre appareil.
 */
export function ResetPasswordForm({
  initialEmail,
  onDone,
  onCancel,
}: {
  initialEmail: string;
  /** Mot de passe changé : l'utilisateur est connecté. */
  onDone: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const sendCode = async () => {
    const problem = checkEmail(email);
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setCodeSent(true);
  };

  const changePassword = async () => {
    const problem = checkPasswordReset({ email, code, password });
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await resetPassword({ email, code, password });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone();
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder },
  ];

  return (
    <View style={styles.form}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Mot de passe oublié
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        {codeSent
          ? `Si un compte existe pour ${email.trim()}, un code à 6 chiffres vient de lui être envoyé. Il est valable une heure.`
          : 'Saisissez votre adresse : vous recevrez un code par e-mail pour choisir un nouveau mot de passe.'}
      </ThemedText>

      {!codeSent && (
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
            onSubmitEditing={sendCode}
            editable={!busy}
            style={inputStyle}
          />
        </View>
      )}

      {codeSent && (
        <>
          <View style={styles.field}>
            <ThemedText type="smallBold">Code reçu</ThemedText>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Code reçu par e-mail"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={12}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              editable={!busy}
              style={inputStyle}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="smallBold">Nouveau mot de passe</ThemedText>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Nouveau mot de passe"
              accessibilityHint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={changePassword}
              editable={!busy}
              style={inputStyle}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Au moins {PASSWORD_MIN_LENGTH} caractères.
            </ThemedText>
          </View>
        </>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      {busy ? (
        <ActivityIndicator color={theme.primary} style={styles.busy} accessibilityLabel="Envoi en cours" />
      ) : (
        <PrimaryButton
          label={codeSent ? 'Changer le mot de passe' : 'Recevoir un code'}
          onPress={codeSent ? changePassword : sendCode}
        />
      )}

      <View style={styles.links}>
        {codeSent && (
          <TextLink
            label="Renvoyer un code"
            disabled={busy}
            onPress={() => {
              setCodeSent(false);
              setCode('');
              setError(null);
            }}
          />
        )}
        <TextLink label="Retour à la connexion" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="link">{label}</ThemedText>
    </Pressable>
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
  links: { alignItems: 'center', gap: Spacing.two },
  link: { minHeight: 44, justifyContent: 'center' },
});
