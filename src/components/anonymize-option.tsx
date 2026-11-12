import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  checked: boolean;
  onToggle: () => void;
  /** Autres mots à masquer, séparés par des virgules. */
  hidden: string;
  onChangeHidden: (value: string) => void;
  /** Ce que l'anonymisation a fait, par exemple « 3 acteurs renommés ». */
  result?: string;
  label?: string;
  description?: string;
};

/**
 * Case « Anonymiser les noms », à l'import et à l'export : les acteurs
 * deviennent Service A, B…, et les mots choisis (le nom de l'entreprise) sont
 * masqués. Les e-mails, téléphones et liens sont masqués d'office.
 */
export function AnonymizeOption({
  checked,
  onToggle,
  hidden,
  onChangeHidden,
  result,
  label = 'Anonymiser les noms',
  description = 'Acteurs → Service A, B… ; e-mails, téléphones et liens masqués',
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.option}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityHint={description}
        style={styles.check}>
        <View
          style={[
            styles.box,
            checked
              ? { backgroundColor: theme.primary, borderColor: theme.primary }
              : { borderColor: theme.fieldBorder, backgroundColor: theme.surface },
          ]}>
          {checked && (
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, lineHeight: 16 }} maxFontSizeMultiplier={1}>
              ✓
            </ThemedText>
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText>{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        </View>
      </Pressable>
      {checked && (
        <View style={styles.field}>
          <ThemedText type="smallBold" nativeID="mots-masques-label">
            Autres mots à masquer
          </ThemedText>
          <TextInput
            value={hidden}
            onChangeText={onChangeHidden}
            placeholder="Nom de l’entreprise, d’un client… séparés par des virgules"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Autres mots à masquer"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.fieldBorder }]}
          />
          {result ? (
            <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
              {result}
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { gap: Spacing.two },
  flex: { flex: 1 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: Spacing.one, paddingLeft: 22 + Spacing.two },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
