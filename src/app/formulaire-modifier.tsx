import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dropdown } from '@/components/form-field';
import { SymbolView } from '@/components/symbol';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { editShownForm, getShownForm } from '@/data/form-store';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  addComplement,
  addCondition,
  addQuestion,
  answersOf,
  changeType,
  cleanForm,
  complementTypes,
  conditionSources,
  dependants,
  EDITABLE_TYPES,
  listKind,
  moveBlock,
  removeCondition,
  removeQuestion,
  splitDocuments,
  toggleAtLeastOne,
  typeLabel,
  updateQuestion,
  type FormQuestion,
  type FormTemplate,
  type QuestionType,
} from '@/import/tableau';
import { confirmAction } from '@/utils/confirm';

/**
 * « Modifier le formulaire » : corriger à la main ce que la lecture du
 * template n'a pas pu deviner. Une question par ligne ; touchée, elle s'ouvre :
 * intitulé, type, obligatoire, choix / champs / documents, aide, conditions
 * d'affichage, compléments (une description sous une pièce jointe, une pièce
 * jointe ou une précision sous une réponse, pour un choix précis ou toujours),
 * monter, descendre, ajouter une question après, supprimer.
 * « Enregistrer » remplace le formulaire affiché (et le formulaire gardé).
 */
export default function FormEditorScreen() {
  const theme = useTheme();
  const t = useT();
  const [shown] = useState(getShownForm);
  if (!shown) {
    return (
      <View style={[styles.screen, styles.empty, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'doc.text', android: 'description' }}
          tone="primary"
          action={{ label: 'Fermer', onPress: () => router.back() }}
          title={t.formEditor.empty}
          message={t.form.emptyText}
        />
      </View>
    );
  }
  return <Editor original={shown.form} />;
}

function Editor({ original }: { original: FormTemplate }) {
  const theme = useTheme();
  const t = useT();
  const fe = t.formEditor;
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(original);
  const [open, setOpen] = useState<number | null>(null);
  // Les boutons de l'en-tête peuvent garder une ancienne version de la fonction : ils lisent le brouillon ici.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const save = () => {
    if (latest.current !== original) editShownForm(cleanForm(latest.current));
    router.back();
  };
  const cancel = () => {
    if (latest.current === original) return router.back();
    confirmAction(fe.discardTitle, fe.discardText, fe.discard, () => router.back(), fe.keepEditing);
  };
  const add = (after: number, type?: QuestionType) => {
    const { form, n } = addQuestion(draft, after, type);
    setDraft(type === 'attachment' ? updateQuestion(form, n, { label: fe.attachment }) : form);
    setOpen(n);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.editForm,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerLeft: () => (
            <Pressable onPress={cancel} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>{t.common.cancel}</ThemedText>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} accessibilityRole="button" hitSlop={12}>
              <ThemedText type="link" style={{ color: theme.link }}>
                {fe.save}
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {draft.name ?? t.form.unnamed}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {fe.intro(t.format.count(draft.questions.length, t.words.question))}
        </ThemedText>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {draft.questions.map((question, index) => (
            <QuestionEditor
              key={question.n}
              question={question}
              index={index}
              form={draft}
              open={open === question.n}
              onToggle={() => setOpen((current) => (current === question.n ? null : question.n))}
              onChange={setDraft}
              onMove={(delta) => {
                const moved = moveBlock(draft, question.n, delta);
                setDraft(moved.form);
                setOpen(moved.n);
              }}
              onAddComplement={(type, option) => {
                const added = addComplement(draft, question.n, type, option);
                setDraft(added.form);
                setOpen(added.n);
              }}
              onAddAfter={(type) => add(question.n, type)}
              onRemove={() => {
                setDraft(removeQuestion(draft, question.n));
                setOpen(null);
              }}
            />
          ))}
        </View>
        <Pressable
          onPress={() => add(draft.questions.at(-1)?.n ?? 0)}
          accessibilityRole="button"
          style={[styles.action, { borderColor: theme.link }]}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {fe.addAtEnd}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function QuestionEditor({
  question,
  index,
  form,
  open,
  onToggle,
  onChange,
  onMove,
  onAddAfter,
  onAddComplement,
  onRemove,
}: {
  question: FormQuestion;
  index: number;
  form: FormTemplate;
  open: boolean;
  onToggle: () => void;
  onChange: (next: FormTemplate) => void;
  onMove: (delta: -1 | 1) => void;
  onAddAfter: (type?: QuestionType) => void;
  onAddComplement: (type: 'text' | 'attachment', option?: string) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const fe = t.formEditor;
  const ALWAYS = fe.alwaysWith;
  const [source, setSource] = useState<number | null>(null);
  const [forOption, setForOption] = useState(ALWAYS);
  const complements = complementTypes(question);
  const choices = answersOf(question);
  const blockEnd =
    form.questions.filter((item) => item.n === question.n || item.partOf === question.n).at(-1)?.n ?? question.n;
  const title = question.label.split('\n')[0] || fe.untitled;
  const kind = listKind(question.type);
  const sources = conditionSources(form, question.n);
  const chosenSource = sources.find((item) => item.n === source);
  const labelOf = (n: number) =>
    form.questions.find((item) => item.n === n)?.label.split('\n')[0] ?? t.field.question(n);
  const update = (patch: Partial<Omit<FormQuestion, 'n'>>) => onChange(updateQuestion(form, question.n, patch));

  const remove = () => {
    const linked = dependants(form, question.n).filter((item) => item.partOf !== question.n).length;
    const own = form.questions.filter((item) => item.partOf === question.n).length;
    const parts = [
      linked > 0 ? fe.dependants(linked, t.format.count(linked, t.words.question)) : fe.removed,
      own > 0 ? fe.complementsRemoved(own) : null,
    ];
    confirmAction(fe.deleteTitle(title), parts.filter(Boolean).join(' '), fe.delete, onRemove, fe.keep);
  };

  return (
    <View
      style={[
        index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        question.partOf !== undefined && styles.complement,
      ]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? fe.collapse : fe.expand}
        style={[styles.row, open && { backgroundColor: theme.primaryBackground }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
          {question.n}
        </ThemedText>
        <View style={styles.flex}>
          <ThemedText numberOfLines={2}>
            {title}
            {question.mandatory && <ThemedText style={{ color: theme.danger }}> *</ThemedText>}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[
              question.partOf !== undefined ? fe.complementOf(question.partOf) : null,
              fe.types[question.type] ?? typeLabel(question.type),
              question.type === 'checkbox' && question.single ? fe.single : null,
              question.conditions.length > 0 ? fe.conditional : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
        <ThemedText type="link" style={{ color: theme.link }}>
          {open ? fe.close : fe.edit}
        </ThemedText>
      </Pressable>

      {open && (
        <View style={styles.form}>
          <Label text={fe.label} />
          <Field
            value={question.label}
            onCommit={(label) => update({ label })}
            accessibilityLabel={fe.labelA11y}
            multiline
          />

          <Label text={fe.type} />
          <View style={styles.options} accessibilityRole="radiogroup">
            {EDITABLE_TYPES.map((item) => {
              const selected = question.type === item.type;
              return (
                <Pressable
                  key={item.type}
                  onPress={() => onChange(changeType(form, question.n, item.type))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? theme.primary : theme.background,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {fe.types[item.type] ?? item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <ThemedText style={styles.flex}>{fe.required}</ThemedText>
            <Switch
              value={question.mandatory}
              onValueChange={(mandatory) => update({ mandatory })}
              accessibilityLabel={fe.required}
              trackColor={{ true: theme.primary }}
            />
          </View>

          {question.type === 'checkbox' && (
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <ThemedText>{fe.multiple}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {question.single ? fe.oneBox : fe.manyBoxes}
                </ThemedText>
              </View>
              <Switch
                value={!question.single}
                onValueChange={(many) => update({ single: many ? undefined : true })}
                accessibilityLabel={fe.multiple}
                trackColor={{ true: theme.primary }}
              />
            </View>
          )}

          {kind && (
            <>
              <Label text={fe.lists[kind].title} />
              {kind === 'documents' && question.documents.filter((document) => document.trim()).length > 1 && (
                <Action label={fe.split} onPress={() => onChange(splitDocuments(form, question.n))} />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {fe.lists[kind].hint}
              </ThemedText>
              <Field
                value={question[kind].join('\n')}
                onCommit={(text) => update({ [kind]: text.split('\n') })}
                accessibilityLabel={fe.lists[kind].title}
                multiline
              />
              {kind === 'fields' && question.fields.filter((field) => field.trim()).length > 1 && (
                <>
                  <Label text={fe.atLeastOne} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {fe.atLeastOneHint}
                  </ThemedText>
                  {question.fields
                    .filter((field) => field.trim())
                    .map((field) => {
                      const checked = question.atLeastOne?.[0]?.includes(field) ?? false;
                      return (
                        <Pressable
                          key={field}
                          onPress={() => onChange(toggleAtLeastOne(form, question.n, field))}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked }}
                          accessibilityLabel={fe.atLeastOneLabel(field)}
                          style={styles.switchRow}>
                          <SymbolView
                            name={
                              checked
                                ? { ios: 'checkmark.square.fill', android: 'check_box' }
                                : { ios: 'square', android: 'check_box_outline_blank' }
                            }
                            size={22}
                            tintColor={checked ? theme.primary : theme.textSecondary}
                          />
                          <ThemedText style={styles.flex}>{field}</ThemedText>
                        </Pressable>
                      );
                    })}
                </>
              )}
            </>
          )}

          <Label text={fe.help} />
          <Field
            value={question.help ?? ''}
            placeholder={fe.none}
            onCommit={(help) => update({ help })}
            accessibilityLabel={fe.help}
          />

          <Label text={fe.shows} />
          {question.conditions.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {fe.always}
            </ThemedText>
          )}
          {question.conditions.map((condition, position) => (
            <View
              key={`${condition.question}-${condition.equals}`}
              style={[styles.chip, { backgroundColor: theme.primaryBackground }]}>
              <ThemedText type="small" style={[styles.flex, { color: theme.link }]}>
                {fe.condition(labelOf(condition.question), condition.equals)}
              </ThemedText>
              <Pressable
                onPress={() => onChange(removeCondition(form, question.n, position))}
                accessibilityRole="button"
                accessibilityLabel={fe.removeCondition(labelOf(condition.question), condition.equals)}
                hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  {t.common.remove}
                </ThemedText>
              </Pressable>
            </View>
          ))}
          {sources.length > 0 && (
            <View style={[styles.newCondition, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {fe.addCondition}
              </ThemedText>
              <Dropdown
                options={sources.map((item) => `${item.n}. ${item.label.split('\n')[0]}`)}
                value={chosenSource ? `${chosenSource.n}. ${chosenSource.label.split('\n')[0]}` : ''}
                onChange={(value) => setSource(Number(value.split('.')[0]))}
                label={fe.sourceLabel}
                borderColor={theme.fieldBorder}
              />
              {chosenSource && (
                <Dropdown
                  options={answersOf(chosenSource)}
                  value=""
                  onChange={(equals) => {
                    onChange(addCondition(form, question.n, { question: chosenSource.n, equals }));
                    setSource(null);
                  }}
                  label={fe.answerLabel}
                  borderColor={theme.fieldBorder}
                />
              )}
            </View>
          )}

          {complements.length > 0 && (
            <View style={[styles.newCondition, { borderColor: theme.border }]}>
              <Label text={fe.complete} />
              <ThemedText type="small" themeColor="textSecondary">
                {fe.completeHint}
              </ThemedText>
              {choices.length > 0 && (
                <Dropdown
                  options={[ALWAYS, ...choices.map((choice) => fe.ifChosen(choice))]}
                  value={forOption}
                  onChange={setForOption}
                  label={fe.whenLabel}
                  borderColor={theme.fieldBorder}
                />
              )}
              <View style={styles.footer}>
                {complements.map((item) => (
                  <Action
                    key={item.type}
                    label={
                      item.type === 'attachment'
                        ? fe.addAttachment
                        : question.type === 'attachment'
                          ? fe.addDescription
                          : fe.addPrecision
                    }
                    onPress={() => {
                      const option = choices.find((choice) => forOption === fe.ifChosen(choice));
                      onAddComplement(item.type, option);
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            {question.partOf === undefined && (
              <>
                <Action label={fe.up} onPress={() => onMove(-1)} disabled={question.n === 1} />
                <Action label={fe.down} onPress={() => onMove(1)} disabled={blockEnd === form.questions.length} />
                <Action label={fe.addAfter} onPress={() => onAddAfter()} />
                <Action label={fe.addAttachmentAfter} onPress={() => onAddAfter('attachment')} />
              </>
            )}
            <Action label={fe.delete} onPress={remove} danger />
          </View>
        </View>
      )}
    </View>
  );
}

/** Un complément qui s'affiche toujours avec sa question. */

function Action({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.link;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.action, { borderColor: color, opacity: disabled ? 0.4 : 1 }]}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Champ de saisie : chaque frappe met le brouillon à jour ; le texte tapé est gardé tel quel. */
function Field({
  value,
  onCommit,
  placeholder,
  accessibilityLabel,
  multiline,
}: {
  value: string;
  onCommit: (text: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
  multiline?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <TextInput
      value={text}
      onChangeText={(next) => {
        setText(next);
        setSynced(next);
        onCommit(next);
      }}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.input,
        multiline && styles.multiline,
        { color: theme.text, backgroundColor: theme.background, borderColor: theme.fieldBorder },
      ]}
    />
  );
}

function Label({ text }: { text: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { justifyContent: 'center', padding: Spacing.four },
  content: { gap: Spacing.two, padding: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  card: { marginTop: Spacing.two, borderRadius: Radius.large, overflow: 'hidden' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  number: { width: 24, textAlign: 'center' },
  complement: { paddingLeft: Spacing.four },
  flex: { flex: 1 },
  form: { gap: Spacing.two, padding: Spacing.three, paddingTop: Spacing.one },
  input: { minHeight: 50, borderRadius: Radius.medium, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 16 },
  multiline: { minHeight: 88, paddingVertical: Spacing.two, textAlignVertical: 'top' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  newCondition: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
});
