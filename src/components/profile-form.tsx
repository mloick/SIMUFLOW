import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProfileError } from '@/backend/profiles';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { nextUsername, profileProblem, ROLE_LABELS, suggestUsername, type Profile, type ProfileRole } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

const ROLES: { value: ProfileRole | null; label: string }[] = [
  { value: 'chef_de_projet', label: ROLE_LABELS.chef_de_projet },
  { value: 'collaborateur', label: ROLE_LABELS.collaborateur },
  { value: null, label: 'Ne pas préciser' },
];

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
        setError(`« ${username} » est déjà pris : « ${other} » est proposé à la place.`);
      } else {
        setError(cause instanceof Error ? cause.message : 'Le profil n’a pas pu être enregistré.');
      }
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder }];
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">
          Votre nom et votre identifiant permettront de vous inviter sur un process partagé.
        </ThemedText>

        <View style={styles.field}>
          <ThemedText type="smallBold">Prénom</ThemedText>
          <TextInput
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              follow(text, lastName);
            }}
            placeholder="Julie"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Prénom"
            autoComplete="given-name"
            textContentType="givenName"
            style={input}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">Nom</ThemedText>
          <TextInput
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              follow(firstName, text);
            }}
            placeholder="Martin"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Nom"
            autoComplete="family-name"
            textContentType="familyName"
            style={input}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">Identifiant</ThemedText>
          <TextInput
            value={username}
            onChangeText={(text) => {
              setUsername(text.toLowerCase().replace(/\s/g, ''));
              setUsernameTouched(true);
            }}
            placeholder="julie.martin"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Identifiant"
            accessibilityHint="Unique, il sert à vous inviter sur un process."
            autoCapitalize="none"
            autoCorrect={false}
            style={input}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Proposé d’après votre nom, modifiable. Unique : il sert à vous inviter.
          </ThemedText>
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold" nativeID="role">
            Rôle
          </ThemedText>
          <View style={styles.roles} accessibilityRole="radiogroup" accessibilityLabelledBy="role">
            {ROLES.map((option) => {
              const selected = option.value === role;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setRole(option.value)}
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
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Une simple mention, visible des personnes avec qui vous partagerez un process.
          </ThemedText>
        </View>

        {error && (
          <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          </View>
        )}

        <PrimaryButton label={busy ? 'Enregistrement…' : 'Enregistrer'} onPress={save} disabled={busy} />
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
