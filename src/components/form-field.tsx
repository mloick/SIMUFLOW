import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FormAnswer, FormQuestion } from '@/import/tableau';

export type { FormAnswer };

/** « Êtes-vous le signataire ? = Non » : la condition d'une question, lisible. */
export function conditionText(question: FormQuestion, questions: FormQuestion[]): string | null {
  if (question.conditions.length === 0) return null;
  return question.conditions
    .map(({ question: source, equals }) => {
      const label = questions.find((item) => item.n === source)?.label.split('\n')[0] ?? `Question ${source}`;
      return `« ${label} » = ${equals}`;
    })
    .join(' et ');
}

const KEYBOARDS: Partial<Record<FormQuestion['type'], KeyboardTypeOptions>> = {
  email: 'email-address',
  url: 'url',
  ip: 'numbers-and-punctuation',
  date: 'numbers-and-punctuation',
  datetime: 'numbers-and-punctuation',
};

const PLACEHOLDERS: Partial<Record<FormQuestion['type'], string>> = {
  date: 'jj/mm/aaaa',
  datetime: 'jj/mm/aaaa hh:mm',
  email: 'nom@exemple.fr',
  url: 'https://',
};

/**
 * Une question du formulaire, dessinée selon son type comme sur un portail
 * de demande : champ de texte, oui / non, menu déroulant, cases à cocher,
 * pièce jointe, libellé avec ses champs… L'obligation est marquée d'un
 * astérisque, l'aide est écrite en italique dessous, et une question qui ne
 * s'affiche que sous condition le dit.
 */
export function FormField({
  question,
  questions,
  value,
  onChange,
  error,
}: {
  question: FormQuestion;
  /** Toutes les questions, pour écrire les conditions avec leurs intitulés. */
  questions: FormQuestion[];
  value: FormAnswer | undefined;
  onChange: (value: FormAnswer) => void;
  /** Ce qui ne va pas dans la réponse, écrit en rouge sous la question. */
  error?: string | null;
}) {
  const theme = useTheme();
  const [title, ...rest] = question.label.split('\n');
  const subtitle = rest.join('\n').trim();
  const condition = conditionText(question, questions);

  if (question.type === 'break') {
    return <View style={[styles.break, { backgroundColor: theme.border }]} accessibilityRole="none" />;
  }
  if (question.type === 'container') {
    return (
      <ThemedText type="subtitle" style={styles.section} accessibilityRole="header">
        {title}
      </ThemedText>
    );
  }

  const text = typeof value === 'string' ? value : '';
  const checked = Array.isArray(value) ? value : [];
  const fieldValues = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const borderColor = error ? theme.danger : theme.fieldBorder;
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor }];

  const addFile = async () => {
    const selection = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: false });
    if (selection.canceled) return;
    const names = selection.assets.map((asset) => asset.name).filter((name) => !checked.includes(name));
    onChange([...checked, ...names]);
  };

  return (
    <View style={styles.question}>
      {condition && (
        <View style={[styles.condition, { backgroundColor: theme.primaryBackground }]}>
          <SymbolView name={{ ios: 'arrow.turn.down.right', android: 'subdirectory_arrow_right' }} size={14} tintColor={theme.link} />
          <ThemedText type="small" style={[styles.flex, { color: theme.link }]}>
            S’affiche si {condition}
          </ThemedText>
        </View>
      )}
      <ThemedText type="smallBold" style={styles.label}>
        {title}
        {question.mandatory && <ThemedText style={{ color: theme.danger }}> *</ThemedText>}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
      {question.help && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.help}>
          {question.help}
        </ThemedText>
      )}

      {(question.type === 'text' ||
        question.type === 'email' ||
        question.type === 'url' ||
        question.type === 'ip' ||
        question.type === 'date' ||
        question.type === 'datetime' ||
        question.type === 'multiline') && (
        <TextInput
          value={text}
          onChangeText={onChange}
          placeholder={question.example ?? PLACEHOLDERS[question.type]}
          placeholderTextColor={theme.textSecondary}
          keyboardType={KEYBOARDS[question.type]}
          multiline={question.type === 'multiline'}
          accessibilityLabel={title}
          style={[...inputStyle, question.type === 'multiline' && styles.multiline]}
        />
      )}

      {question.type === 'yesno' && (
        <Choices options={['Oui', 'Non']} selected={text ? [text] : []} onToggle={(option) => onChange(option)} single label={title} />
      )}

      {question.type === 'select' && (
        <Dropdown options={question.options} value={text} onChange={onChange} label={title} borderColor={borderColor} />
      )}

      {question.type === 'scale' && (
        <Choices
          options={question.options.length > 0 ? question.options : ['1', '2', '3', '4', '5']}
          selected={text ? [text] : []}
          onToggle={(option) => onChange(option)}
          single
          label={title}
        />
      )}

      {question.type === 'checkbox' &&
        (question.options.length > 0 ? (
          <Checkboxes
            options={question.options}
            checked={checked}
            onChange={onChange}
          />
        ) : (
          <Checkboxes options={[title]} checked={checked} onChange={onChange} />
        ))}

      {(question.type === 'list' || question.type === 'reference') && (
        <View style={[styles.placeholderBox, { borderColor: theme.fieldBorder, backgroundColor: theme.surfaceMuted }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Choix dans les données de l’outil (liste remplie au moment de la demande)
          </ThemedText>
          {question.explanation && (
            <ThemedText type="small" themeColor="textSecondary">
              {question.explanation}
            </ThemedText>
          )}
        </View>
      )}

      {question.type === 'attachment' && (
        <View style={[styles.attachment, { borderColor }]}>
          {checked.map((name) => (
            <View key={name} style={styles.row}>
              <SymbolView name={{ ios: 'doc', android: 'description' }} size={18} tintColor={theme.textSecondary} />
              <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                {name}
              </ThemedText>
              <Pressable
                onPress={() => onChange(checked.filter((item) => item !== name))}
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${name}`}
                hitSlop={12}>
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={20} tintColor={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addFile} accessibilityRole="button" accessibilityLabel={`${title} : ajouter un fichier`} style={styles.row}>
            <SymbolView name={{ ios: 'paperclip', android: 'attach_file' }} size={18} tintColor={theme.link} />
            <ThemedText type="link" style={{ color: theme.link }}>
              {checked.length > 0 ? 'Ajouter un autre fichier' : 'Ajouter un fichier'}
            </ThemedText>
          </Pressable>
          {question.documents.length > 0 && (
            <View style={styles.documents}>
              <ThemedText type="small" themeColor="textSecondary">
                Documents attendus :
              </ThemedText>
              {question.documents.map((document) => (
                <ThemedText key={document} type="small" themeColor="textSecondary">
                  • {document}
                </ThemedText>
              ))}
            </View>
          )}
        </View>
      )}

      {(question.type === 'label' || question.type === 'richlabel') &&
        (question.fields.length > 0 ? (
          question.fields.map((field) => (
            <View key={field} style={styles.subfield}>
              <ThemedText type="small">
                {field}
                {question.limits?.[field] ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {` · ${question.limits[field]} caractères au plus`}
                  </ThemedText>
                ) : null}
              </ThemedText>
              <TextInput
                value={fieldValues[field] ?? ''}
                onChangeText={(next) => onChange({ ...fieldValues, [field]: next })}
                maxLength={question.limits?.[field]}
                accessibilityLabel={`${title} : ${field}`}
                accessibilityHint={question.limits?.[field] ? `${question.limits[field]} caractères au plus` : undefined}
                style={inputStyle}
              />
            </View>
          ))
        ) : question.explanation ? (
          <ThemedText type="small" themeColor="textSecondary">
            {question.explanation}
          </ThemedText>
        ) : null)}

      {error && (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <SymbolView name={{ ios: 'exclamationmark.circle.fill', android: 'error' }} size={16} tintColor={theme.danger} />
          <ThemedText type="small" style={[styles.flex, { color: theme.danger }]}>
            {error}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function Choices({
  options,
  selected,
  onToggle,
  label,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  single?: boolean;
  label: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[
              styles.chip,
              { backgroundColor: on ? theme.primary : theme.surface, borderColor: on ? theme.primary : theme.fieldBorder },
            ]}>
            <ThemedText type="smallBold" style={{ color: on ? theme.onPrimary : theme.text }}>
              {option}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Checkboxes({
  options,
  checked,
  onChange,
}: {
  options: string[];
  checked: string[];
  onChange: (value: string[]) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.options}>
      {options.map((option) => {
        const on = checked.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onChange(on ? checked.filter((item) => item !== option) : [...checked, option])}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={styles.option}>
            <SymbolView
              name={on ? { ios: 'checkmark.square.fill', android: 'check_box' } : { ios: 'square', android: 'check_box_outline_blank' }}
              size={22}
              tintColor={on ? theme.primary : theme.textSecondary}
            />
            <ThemedText style={styles.flex}>{option}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Dropdown({
  options,
  value,
  onChange,
  label,
  borderColor,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  borderColor: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || 'Aucun choix' }}
        accessibilityState={{ expanded: open }}
        style={[styles.input, styles.dropdown, { backgroundColor: theme.surface, borderColor }]}>
        <ThemedText style={[styles.flex, !value && { color: theme.textSecondary }]}>{value || '— Choisir —'}</ThemedText>
        <SymbolView
          name={open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }}
          size={18}
          tintColor={theme.textSecondary}
        />
      </Pressable>
      {open && (
        <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.fieldBorder }]}>
          {options.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.menuItem}>
              Aucun choix dans le template
            </ThemedText>
          )}
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: option === value }}
              style={[styles.menuItem, option === value && { backgroundColor: theme.primaryBackground }]}>
              <ThemedText>{option}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  question: { gap: Spacing.two },
  label: { fontSize: 16 },
  help: { fontStyle: 'italic' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  section: { fontSize: 20, marginTop: Spacing.two },
  break: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  condition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  menu: { borderWidth: 1, borderRadius: Radius.small, marginTop: Spacing.one, overflow: 'hidden' },
  menuItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three - Spacing.one, paddingVertical: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.pill, borderWidth: 1 },
  options: { gap: Spacing.one },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  placeholderBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.small, padding: Spacing.three, gap: Spacing.one },
  attachment: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.small, padding: Spacing.three, gap: Spacing.two },
  documents: { gap: Spacing.half },
  subfield: { gap: Spacing.one },
});
