import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProfileError } from '@/backend/profiles';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { nextUsername, profileProblem, suggestUsername, type Profile, type ProfileRole } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const ROLES: (ProfileRole | null)[] = ['chef_de_projet', 'collaborateur', null];

/**
 * Formulaire du profil : prénom, nom, identifiant (proposé d'après le nom tant
 * qu'il n'est pas modifié à la main) et rôle. `onSave` enregistre ; s'il lève
 * une `ProfileError` « identifiant pris », une variante est proposée.
 */
export function ProfileForm({
  initial,
  onSave,
}: {
  initial: Profile | null;
  onSave: (profile: Profile) => Promise<unknown>;
}) {
  const theme = useTheme();
  const t = useT();
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  // Tant que l'identifiant n'est pas modifié à la main, il suit le prénom et le nom.
  const [usernameTouched, setUsernameTouched] = useState(Boolean(initial));
  const [role, setRole] = useState<ProfileRole | null>(initial?.role ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const follow = (first: string, last: string) => {
    if (!usernameTouched) setUsername(suggestUsername(first, last));
  };

  const save = async () => {
    const profile: Profile = { firstName, lastName, username, ...(role ? { role } : {}) };
    const problem = profileProblem(profile);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await onSave(profile);
    } catch (cause) {
      if (cause instanceof ProfileError && cause.taken) {
        const other = nextUsername(username);
        setUsername(other);
        setUsernameTouched(true);
        setError(t.profileForm.taken(username, other));
      } else {
        setError(cause instanceof Error ? cause.message : t.profileForm.failed);
      }
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder }];
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">{t.profileForm.intro}</ThemedText>

        <View style={styles.field}>
          <ThemedText type="smallBold">{t.profileForm.firstName}</ThemedText>
          <TextInput
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              follow(text, lastName);
            }}
            placeholder="Julie"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.profileForm.firstName}
            autoComplete="given-name"
            textContentType="givenName"
            style={input}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">{t.profileForm.lastName}</ThemedText>
          <TextInput
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              follow(firstName, text);
            }}
            placeholder="Martin"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.profileForm.lastName}
            autoComplete="family-name"
            textContentType="familyName"
            style={input}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">{t.profileForm.username}</ThemedText>
          <TextInput
            value={username}
            onChangeText={(text) => {
              setUsername(text.toLowerCase().replace(/\s/g, ''));
              setUsernameTouched(true);
            }}
            placeholder="julie.martin"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.profileForm.username}
            accessibilityHint={t.profileForm.usernameHint}
            autoCapitalize="none"
            autoCorrect={false}
            style={input}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t.profileForm.usernameHelp}
          </ThemedText>
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold" nativeID="role">
            {t.profileForm.role}
          </ThemedText>
          <View style={styles.roles} accessibilityRole="radiogroup" accessibilityLabelledBy="role">
            {ROLES.map((option) => {
              const selected = option === role;
              const label = option ? t.roles[option] : t.profileForm.noRole;
              return (
                <Pressable
                  key={label}
                  onPress={() => setRole(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.role,
                    {
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderColor: selected ? theme.primary : theme.fieldBorder,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t.profileForm.roleHelp}
          </ThemedText>
        </View>

        {error && (
          <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          </View>
        )}

        <PrimaryButton label={busy ? t.common.saving : t.common.save} onPress={save} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
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
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  role: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  notice: { padding: Spacing.three, borderRadius: Radius.medium },
});
