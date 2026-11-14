import * as DocumentPicker from 'expo-document-picker';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { readPickedFile } from '@/utils/read-file';
import { useT } from '@/i18n';

/** Exemple fictif proposé par « Voir un exemple » : il montre tout le format. */
export const TEXT_EXAMPLE = `Process : Demande de matériel
1. Employé : Faire la demande
2. Responsable : Demande validée ? (2 JO)
   oui → 3
   non → 5
3. Achats : Passer la commande (1 JO)
4. Logistique : Livrer le matériel (5 JO) → 6
5. Responsable : Prévenir du refus (1 JO) → 6
6. Fin : Demande close`;

/**
 * Source « Texte » de l'import : un process écrit, une ligne par étape, collé
 * dans la zone ou lu dans un fichier .txt. `onRead` reçoit le texte (et le nom
 * du fichier s'il vient d'un fichier).
 */
export function TextSource({
  value,
  onChange,
  onRead,
}: {
  value: string;
  onChange: (text: string) => void;
  onRead: (text: string, fileName?: string) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const x = t.textSource;

  const pickFile = async () => {
    const selection = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'text/markdown', 'text/*'],
      copyToCacheDirectory: true,
    });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    const content = await readPickedFile(asset);
    onChange(content);
    onRead(content, asset.name);
  };

  return (
    <View style={styles.box}>
      <ThemedText type="small" themeColor="textSecondary">
        {x.help}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        autoCorrect={false}
        autoCapitalize="sentences"
        placeholder={x.placeholder}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={x.label}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: theme.fieldBorder,
          },
        ]}
      />
      <PrimaryButton label={x.read} onPress={() => onRead(value)} disabled={!value.trim()} />
      <View style={styles.row}>
        <Pressable onPress={() => onChange(TEXT_EXAMPLE)} accessibilityRole="button" style={styles.link} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {x.example}
          </ThemedText>
        </Pressable>
        <Pressable onPress={pickFile} accessibilityRole="button" style={styles.link} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {x.pickFile}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
  input: {
    minHeight: 240,
    borderRadius: Radius.small,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  link: { minHeight: 44, justifyContent: 'center' },
});
