import { router, Stack, useLocalSearchParams } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signIn, signUp } from '@/backend/auth';
import { checkCredentials } from '@/backend/auth-messages';
import { HelpSheet } from '@/components/help-button';
import { LaunchIllustration } from '@/components/launch-illustration';
import { PressableScale } from '@/components/pressable-scale';
import { PrimaryButton } from '@/components/primary-button';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { SimuflowLogo } from '@/components/simuflow-logo';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { PRIVACY_URL } from '@/constants/links';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

type Mode = 'connexion' | 'creation' | 'oubli';

/**
 * Connexion et création de compte (refonte). En haut, l'illustration du
 * lancement ; en bas, une feuille avec le formulaire.
 *
 * Au premier lancement (`?lancement=1`), c'est le premier écran : « Continuer
 * sans compte » ou une connexion réussie mènent à la présentation. Ouvert depuis
 * l'app (Profil, partage…), une croix le ferme et une connexion réussie y revient.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const launch = useLocalSearchParams<{ lancement?: string }>().lancement === '1';
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkMail, setCheckMail] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const creating = mode === 'creation';

  // Après la connexion, ou sans compte : la présentation au premier lancement, sinon retour à l'écran d'avant.
  const leave = () => {
    if (launch) router.replace('/bienvenue');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const submit = async () => {
    const problem = checkCredentials({ email, password }, creating ? 'creation' : 'connexion');
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await (creating ? signUp : signIn)({ email, password });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.needsConfirmation) return setCheckMail(true);
    leave();
  };

  const switchMode = () => {
    setMode(creating ? 'connexion' : 'creation');
    setError(null);
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: theme.border },
  ];

  let sheet;
  if (mode === 'oubli') {
    sheet = (
      <ResetPasswordForm
        initialEmail={email}
        onCancel={() => {
          setMode('connexion');
          setError(null);
        }}
      />
    );
  } else if (checkMail) {
    sheet = (
      <>
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
      </>
    );
  } else {
    sheet = (
      <>
        <View style={styles.heading}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {creating ? t.signIn.titleCreate : t.signIn.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{creating ? t.signIn.subtitleCreate : t.signIn.subtitle}</ThemedText>
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t.common.emailLabel}
          </ThemedText>
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
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t.signIn.password}
          </ThemedText>
          <View>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder={t.signIn.passwordPlaceholder}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t.signIn.password}
              accessibilityHint={creating ? t.auth.passwordRule : undefined}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={creating ? 'new-password' : 'current-password'}
              textContentType={creating ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
              style={[inputStyle, styles.passwordInput]}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t.signIn.hidePassword : t.signIn.showPassword}
              style={styles.eye}>
              <SymbolView
                name={
                  showPassword ? { ios: 'eye.slash', android: 'visibility_off' } : { ios: 'eye', android: 'visibility' }
                }
                size={20}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          </View>
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

        {launch && (
          <>
            <View style={styles.or}>
              <View style={[styles.orLine, { backgroundColor: theme.border }]} />
              <ThemedText type="small" themeColor="textSecondary">
                {t.signIn.or}
              </ThemedText>
              <View style={[styles.orLine, { backgroundColor: theme.border }]} />
            </View>
            <PressableScale
              onPress={leave}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.outline, { borderColor: theme.border }]}>
              <ThemedText style={styles.outlineLabel}>{t.signIn.continueWithout}</ThemedText>
              <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward' }} size={18} tintColor={theme.text} />
            </PressableScale>
          </>
        )}

        <Pressable onPress={() => setWhy(true)} accessibilityRole="button" style={styles.why}>
          <SymbolView name={{ ios: 'questionmark.circle', android: 'help' }} size={16} tintColor={theme.link} />
          <ThemedText type="link" style={styles.whyLabel}>
            {t.signIn.why}
          </ThemedText>
        </Pressable>
        <HelpSheet visible={why} title={t.signIn.why} text={t.signIn.whyText} onClose={() => setWhy(false)} />

        <View style={styles.switch}>
          <ThemedText type="small" themeColor="textSecondary">
            {creating ? t.signIn.haveAccount : t.signIn.noAccount}
          </ThemedText>
          <Pressable
            onPress={switchMode}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.switchButton}>
            <ThemedText type="link" style={styles.switchLabel}>
              {creating ? t.common.signIn : t.signIn.switchCreate}
            </ThemedText>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !launch }} />
      <ScrollView
        style={{ backgroundColor: theme.surface }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.four }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.top, { backgroundColor: theme.primaryBackground }]}>
          <LaunchIllustration top={insets.top + Spacing.four} />
          <View style={[styles.brand, { top: insets.top + Spacing.three }]}>
            <SimuflowLogo size={34} />
            <ThemedText style={styles.brandName}>SimuFlow</ThemedText>
            {!launch && (
              <Pressable
                onPress={leave}
                accessibilityRole="button"
                accessibilityLabel={t.signIn.close}
                hitSlop={8}
                style={[styles.close, { backgroundColor: theme.surface }]}>
                <SymbolView name={{ ios: 'xmark', android: 'close' }} size={16} tintColor={theme.text} />
              </Pressable>
            )}
          </View>
        </View>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          {sheet}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  top: { overflow: 'hidden' },
  brand: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandName: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: 800, letterSpacing: -0.4 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    flexGrow: 1,
    marginTop: -Spacing.five,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center' },
  heading: { gap: Spacing.one },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 800, letterSpacing: -0.6 },
  center: { textAlign: 'center' },
  field: { gap: 6 },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  passwordInput: { paddingRight: 52 },
  eye: {
    position: 'absolute',
    right: 4,
    top: 3,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { minHeight: 52 },
  forgot: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  outline: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  outlineLabel: { fontSize: 16, fontWeight: 700 },
  why: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  whyLabel: { fontSize: 14 },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 'auto',
  },
  switchButton: { minHeight: 44, justifyContent: 'center' },
  switchLabel: { fontSize: 14, fontWeight: 800 },
});
