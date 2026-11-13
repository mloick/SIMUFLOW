import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dropdown } from '@/components/form-field';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { editShownForm, getShownForm } from '@/data/form-store';
import { useTheme } from '@/hooks/use-theme';
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
  typeLabel,
  updateQuestion,
  type FormQuestion,
  type FormTemplate,
  type QuestionType,
} from '@/import/tableau';
import { confirmAction } from '@/utils/confirm';
import { plural } from '@/utils/format';

const LIST_LABELS = {
  options: { title: 'Choix', hint: 'Un choix par ligne' },
  fields: { title: 'Champs à remplir', hint: 'Un champ par ligne (Nom, Prénom, Téléphone…)' },
  documents: { title: 'Documents attendus', hint: 'Un document par ligne (affichés sous « Ajouter un fichier »)' },
} as const;

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
  const [shown] = useState(getShownForm);
  if (!shown) {
    return (
      <View style={[styles.screen, styles.empty, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'doc.text', android: 'description' }}
          tone="primary"
          action={{ label: 'Fermer', onPress: () => router.back() }}
          title="Aucun formulaire à modifier"
          message="Importez un template de formulaire (Excel) depuis « Nouveau process »."
        />
      </View>
    );
  }
  return <Editor original={shown.form} />;
}

function Editor({ original }: { original: FormTemplate }) {
  const theme = useTheme();
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
    confirmAction(
      'Abandonner les modifications ?',
      'Le formulaire restera tel qu’il était.',
      'Abandonner',
      () => router.back(),
      'Continuer à modifier',
    );
  };
  const add = (after: number, type?: QuestionType) => {
    const { form, n } = addQuestion(draft, after, type);
    setDraft(type === 'attachment' ? updateQuestion(form, n, { label: 'Pièce jointe' }) : form);
    setOpen(n);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Modifier le formulaire',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerLeft: () => (
            <Pressable onPress={cancel} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>Annuler</ThemedText>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} accessibilityRole="button" hitSlop={12}>
              <ThemedText type="link" style={{ color: theme.link }}>
                Enregistrer
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
          {draft.name ?? 'Formulaire sans nom'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {plural(draft.questions.length, 'question')}. Touchez une question pour la modifier, la déplacer ou la
          supprimer. Le template d’origine n’est pas modifié.
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
            Ajouter une question à la fin
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
  const [source, setSource] = useState<number | null>(null);
  const [forOption, setForOption] = useState(ALWAYS);
  const complements = complementTypes(question);
  const choices = answersOf(question);
  const blockEnd = form.questions.filter((item) => item.n === question.n || item.partOf === question.n).at(-1)?.n ?? question.n;
  const title = question.label.split('\n')[0] || 'Question sans titre';
  const kind = listKind(question.type);
  const sources = conditionSources(form, question.n);
  const chosenSource = sources.find((item) => item.n === source);
  const labelOf = (n: number) => form.questions.find((item) => item.n === n)?.label.split('\n')[0] ?? `Question ${n}`;
  const update = (patch: Partial<Omit<FormQuestion, 'n'>>) => onChange(updateQuestion(form, question.n, patch));

  const remove = () => {
    const linked = dependants(form, question.n).filter((item) => item.partOf !== question.n).length;
    const own = form.questions.filter((item) => item.partOf === question.n).length;
    const parts = [
      linked > 0
        ? `${plural(linked, 'question')} ${linked > 1 ? 'dépendent' : 'dépend'} de sa réponse : ${linked > 1 ? 'elles s’afficheront' : 'elle s’affichera'} sans cette condition.`
        : 'Elle sera retirée du formulaire.',
      own > 0 ? `${own > 1 ? `Ses ${own} compléments seront supprimés` : 'Son complément sera supprimé'} avec elle.` : null,
    ];
    confirmAction(
      `Supprimer « ${title} » ?`,
      parts.filter(Boolean).join(' '),
      'Supprimer',
      onRemove,
      'Garder',
    );
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
        accessibilityHint={open ? 'Replie la question' : 'Ouvre la question pour la modifier'}
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
              question.partOf !== undefined ? `↳ complément de ${question.partOf}` : null,
              typeLabel(question.type),
              question.conditions.length > 0 ? 'conditionnelle' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
        <ThemedText type="link" style={{ color: theme.link }}>
          {open ? 'Fermer' : 'Modifier'}
        </ThemedText>
      </Pressable>

      {open && (
        <View style={styles.form}>
          <Label text="Intitulé" />
          <Field value={question.label} onCommit={(label) => update({ label })} accessibilityLabel="Intitulé de la question" multiline />

          <Label text="Type" />
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
                    { backgroundColor: selected ? theme.primary : theme.background, borderColor: selected ? theme.primary : theme.border },
                  ]}>
                  <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <ThemedText style={styles.flex}>Réponse obligatoire</ThemedText>
            <Switch
              value={question.mandatory}
              onValueChange={(mandatory) => update({ mandatory })}
              accessibilityLabel="Réponse obligatoire"
              trackColor={{ true: theme.primary }}
            />
          </View>

          {kind && (
            <>
              <Label text={LIST_LABELS[kind].title} />
              {kind === 'documents' && question.documents.filter((document) => document.trim()).length > 1 && (
                <Action label="Une pièce jointe par document" onPress={() => onChange(splitDocuments(form, question.n))} />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {LIST_LABELS[kind].hint}
              </ThemedText>
              <Field
                value={question[kind].join('\n')}
                onCommit={(text) => update({ [kind]: text.split('\n') })}
                accessibilityLabel={LIST_LABELS[kind].title}
                multiline
              />
            </>
          )}

          <Label text="Aide sous la question" />
          <Field value={question.help ?? ''} placeholder="Aucune" onCommit={(help) => update({ help })} accessibilityLabel="Aide sous la question" />

          <Label text="S’affiche" />
          {question.conditions.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Toujours.
            </ThemedText>
          )}
          {question.conditions.map((condition, position) => (
            <View key={`${condition.question}-${condition.equals}`} style={[styles.chip, { backgroundColor: theme.primaryBackground }]}>
              <ThemedText type="small" style={[styles.flex, { color: theme.link }]}>
                Si « {labelOf(condition.question)} » = {condition.equals}
              </ThemedText>
              <Pressable
                onPress={() => onChange(removeCondition(form, question.n, position))}
                accessibilityRole="button"
                accessibilityLabel={`Retirer la condition : ${labelOf(condition.question)} = ${condition.equals}`}
                hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  Retirer
                </ThemedText>
              </Pressable>
            </View>
          ))}
          {sources.length > 0 && (
            <View style={[styles.newCondition, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Ajouter une condition : la question s’affiche si…
              </ThemedText>
              <Dropdown
                options={sources.map((item) => `${item.n}. ${item.label.split('\n')[0]}`)}
                value={chosenSource ? `${chosenSource.n}. ${chosenSource.label.split('\n')[0]}` : ''}
                onChange={(value) => setSource(Number(value.split('.')[0]))}
                label="Question dont dépend l’affichage"
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
                  label="Réponse qui fait apparaître la question"
                  borderColor={theme.fieldBorder}
                />
              )}
            </View>
          )}

          {complements.length > 0 && (
            <View style={[styles.newCondition, { borderColor: theme.border }]}>
              <Label text="Compléter la question" />
              <ThemedText type="small" themeColor="textSecondary">
                Ajoute un champ qui s’affiche avec elle, par exemple la description d’un fichier joint, ou un fichier et une
                précision quand on choisit « Autre ».
              </ThemedText>
              {choices.length > 0 && (
                <Dropdown
                  options={[ALWAYS, ...choices.map((choice) => `Si « ${choice} » est choisi`)]}
                  value={forOption}
                  onChange={setForOption}
                  label="Quand afficher le complément"
                  borderColor={theme.fieldBorder}
                />
              )}
              <View style={styles.footer}>
                {complements.map((item) => (
                  <Action
                    key={item.type}
                    label={`Ajouter ${item.label.charAt(0).toLowerCase()}${item.label.slice(1)}`}
                    onPress={() => {
                      const option = choices.find((choice) => forOption === `Si « ${choice} » est choisi`);
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
                <Action label="Monter" onPress={() => onMove(-1)} disabled={question.n === 1} />
                <Action label="Descendre" onPress={() => onMove(1)} disabled={blockEnd === form.questions.length} />
                <Action label="Ajouter une question après" onPress={() => onAddAfter()} />
                <Action label="Ajouter une pièce jointe après" onPress={() => onAddAfter('attachment')} />
              </>
            )}
            <Action label="Supprimer" onPress={remove} danger />
          </View>
        </View>
      )}
    </View>
  );
}

/** Un complément qui s'affiche toujours avec sa question. */
const ALWAYS = 'Toujours, avec la question';

function Action({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
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
  card: { marginTop: Spacing.two, borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
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
  input: { minHeight: 44, borderRadius: Radius.small, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 16 },
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
