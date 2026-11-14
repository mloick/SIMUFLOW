import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { type ComponentRef, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { signIn, signUp } from '@/backend/auth';
import { checkCredentials } from '@/backend/auth-messages';
import { PrimaryButton } from '@/components/primary-button';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { SimuflowLogo } from '@/components/simuflow-logo';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_URL } from '@/constants/links';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

type Mode = 'connexion' | 'creation' | 'oubli';

export default function SignInScreen() {
  const theme = useTheme();
  const t = useT();
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkMail, setCheckMail] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const creating = mode === 'creation';

  const submit = async () => {
    const problem = checkCredentials({ email, password }, creating ? 'creation' : 'connexion');
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await (creating ? signUp : signIn)({ email, password });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.needsConfirmation) return setCheckMail(true);
    router.back();
  };

  const switchMode = () => {
    setMode(creating ? 'connexion' : 'creation');
    setError(null);
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder },
  ];

  if (mode === 'oubli') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <ResetPasswordForm
            initialEmail={email}
            onCancel={() => {
              setMode('connexion');
              setError(null);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (checkMail) {
    return (
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t.signIn.checkMail}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t.signIn.confirmSent(email.trim())}</ThemedText>
        <PrimaryButton
          label={t.common.signIn}
          onPress={() => {
            setCheckMail(false);
            setMode('connexion');
          }}
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <SimuflowLogo />
          <ThemedText type="title" accessibilityRole="header">
            SimuFlow
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {creating ? t.signIn.taglineCreate : t.signIn.tagline}
          </ThemedText>
        </View>

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
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
            editable={!busy}
            style={inputStyle}
          />
        </View>
        <View style={styles.field}>
          <ThemedText type="smallBold">{t.signIn.password}</ThemedText>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t.signIn.password}
            accessibilityHint={creating ? t.auth.passwordRule : undefined}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={creating ? 'new-password' : 'current-password'}
            textContentType={creating ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
            style={inputStyle}
          />
          {creating ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t.auth.passwordRule}
            </ThemedText>
          ) : (
            <Pressable
              onPress={() => {
                setMode('oubli');
                setError(null);
              }}
              disabled={busy}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.forgot, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText type="link">{t.signIn.forgot}</ThemedText>
            </Pressable>
          )}
        </View>

        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        )}

        {busy ? (
          <ActivityIndicator color={theme.primary} style={styles.busy} accessibilityLabel={t.common.sending} />
        ) : (
          <PrimaryButton label={creating ? t.signIn.createAccount : t.common.signIn} onPress={submit} />
        )}

        {creating && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t.signIn.privacyNote}{' '}
            <ThemedText
              type="small"
              style={{ color: theme.link, textDecorationLine: 'underline' }}
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
              {t.signIn.privacy}
            </ThemedText>
          </ThemedText>
        )}

        <View style={[styles.switch, { borderColor: theme.border }]}>
          <ThemedText themeColor="textSecondary">{creating ? t.signIn.haveAccount : t.signIn.noAccount}</ThemedText>
          <Pressable
            onPress={switchMode}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, { borderColor: theme.primary, opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="link">{creating ? t.common.signIn : t.signIn.switchCreate}</ThemedText>
          </Pressable>
        </View>
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
  brand: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  center: { textAlign: 'center' },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  busy: { minHeight: 48 },
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  switch: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondary: {
    minHeight: 48,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.small,
    borderWidth: 1.5,
  },
});
