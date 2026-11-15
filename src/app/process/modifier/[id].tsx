import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess, isImported, updateImportedProcess } from '@/data/process-store';
import { learnFromCorrection } from '@/data/rules-store';
import {
  actorsOf,
  addBranch,
  addStepAfter,
  makeDecision,
  removeLink,
  removeStep,
  renameLink,
  setSla,
  summarize,
  updateStep,
  type Process,
  type Step,
  type StepKind,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { useT } from '@/i18n';

const KINDS: StepKind[] = ['start', 'task', 'decision', 'end'];

/**
 * Éditeur d'un process importé : SLA du process (mode Délais), titre, rôle, acteur et délai (OLA) de chaque étape,
 * noms des branches, étapes et cas ajoutés ou retirés. Les changements restent un brouillon jusqu'à
 * « Enregistrer » ; le diagnostic suit en direct.
 */
export default function EditProcessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const process = getProcess(id);
  const theme = useTheme();
  const t = useT();

  if (!process || !isImported(id)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title={t.detail.notFound}
          message={t.editor.notFoundText}
          action={{ label: t.tracking.back, onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <Editor original={process} />;
}

function Editor({ original }: { original: Process }) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(original);
  const [open, setOpen] = useState<string | null>(null);
  // Les boutons de l'en-tête peuvent garder une ancienne version de la fonction :
  // ils lisent le brouillon ici.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const summary = useMemo(() => summarize(draft), [draft]);
  const actors = useMemo(() => actorsOf(draft), [draft]);
  const toFix = summary.errorCount + summary.warningCount;

  const save = () => {
    if (latest.current !== original) {
      updateImportedProcess(latest.current);
      // Ce qui vaut pour tout le schéma (un acteur renommé partout, une forme = un rôle) sert aux imports suivants.
      learnFromCorrection(original, latest.current);
    }
    router.back();
  };
  const cancel = () => {
    if (latest.current === original) return router.back();
    confirmAction(
      t.editor.discardTitle,
      t.editor.discardText,
      t.editor.discard,
      () => router.back(),
      t.editor.keepEditing,
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.edit,
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
                {t.common.save}
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
          {draft.name}
        </ThemedText>
        <ThemedText
          accessibilityLiveRegion="polite"
          style={{ color: toFix > 0 ? (summary.errorCount > 0 ? theme.danger : theme.warning) : theme.success }}>
          {t.format.count(summary.stepCount, t.words.step)} · {t.format.count(summary.decisionCount, t.words.decision)}{' '}
          · {toFix > 0 ? t.editor.toFix(t.format.count(toFix, t.editor.point)) : t.editor.noIssue}
        </ThemedText>

        <View
          style={[
            styles.card,
            styles.form,
            styles.delays,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Label text={t.delays.slaField} />
          <Field
            value={draft.sla !== undefined ? t.format.num(draft.sla) : ''}
            placeholder={t.delays.slaPlaceholder}
            keyboardType="decimal-pad"
            onCommit={(text) => {
              const value = text.trim().replace(',', '.');
              setDraft((current) => setSla(current, value ? Number(value) : null));
            }}
            accessibilityLabel={t.delays.slaFieldLabel}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t.delays.slaHint}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {t.editor.tapStep}
        </ThemedText>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {draft.steps.map((step, index) => (
            <StepEditor
              key={step.id}
              step={step}
              index={index}
              process={draft}
              actors={actors}
              open={open === step.id}
              onToggle={() => setOpen((current) => (current === step.id ? null : step.id))}
              onOpen={setOpen}
              onChange={setDraft}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StepEditor({
  step,
  index,
  process,
  actors,
  open,
  onToggle,
  onOpen,
  onChange,
}: {
  step: Step;
  index: number;
  process: Process;
  actors: string[];
  open: boolean;
  onToggle: () => void;
  onOpen: (stepId: string) => void;
  onChange: (next: Process) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const e = t.editor;
  const [caseName, setCaseName] = useState('');
  // Cible du nouveau cas : une étape existante, ou une nouvelle étape (undefined).
  const [caseTarget, setCaseTarget] = useState<string | undefined>();
  const exits = process.links.filter((link) => link.from === step.id);
  const titleOf = (id: string) => process.steps.find((other) => other.id === id)?.title || t.untitled;
  const unnamed = exits.filter((link) => !link.label?.trim()).length;
  const kindLabel = t.kinds[step.kind];
  const others = process.steps.filter((other) => other.id !== step.id);
  const isDecision = step.kind === 'decision';
  const targets: { id: string | undefined; title: string }[] = isDecision
    ? [{ id: undefined, title: e.newStep }, ...others]
    : others.filter((other) => !exits.some((link) => link.to === other.id));
  const canAdd = isDecision ? caseName.trim() !== '' : caseTarget !== undefined;

  const addAfter = () => {
    const { process: next, stepId } = addStepAfter(process, step.id, '');
    onChange(next);
    onOpen(stepId);
  };
  const addCase = () => {
    onChange(addBranch(process, step.id, caseName, caseTarget));
    setCaseName('');
    setCaseTarget(undefined);
  };
  const remove = () => {
    const links = process.links.filter((link) => link.from === step.id || link.to === step.id).length;
    confirmAction(
      e.deleteTitle(step.title || t.untitled),
      links > 0 ? e.deleteLinks(t.format.count(links, t.words.link)) : e.noLinks,
      e.delete,
      () => onChange(removeStep(process, step.id)),
      e.keep,
    );
  };

  return (
    <View style={index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? e.collapse : e.expand}
        style={[styles.row, open && { backgroundColor: theme.primaryBackground }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
          {index + 1}
        </ThemedText>
        <View style={styles.flex}>
          <ThemedText>{step.title || t.untitled}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[kindLabel, step.actor, step.duration ? t.format.count(step.duration, t.words.workingDay) : null]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
        <ThemedText type="link" style={{ color: theme.link }}>
          {open ? e.close : e.edit}
        </ThemedText>
      </Pressable>

      {open && (
        <View style={styles.form}>
          <Label text={e.title} />
          <Field
            value={step.title}
            onCommit={(title) => onChange(updateStep(process, step.id, { title }))}
            accessibilityLabel={e.titleLabel}
          />

          <Label text={e.role} />
          <View style={styles.options} accessibilityRole="radiogroup">
            {KINDS.map((kind) => {
              const selected = step.kind === kind;
              return (
                <Pressable
                  key={kind}
                  onPress={() => onChange(updateStep(process, step.id, { kind }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? theme.primary : theme.background,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {t.kinds[kind]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Label text={e.actor} />
          <Field
            value={step.actor ?? ''}
            placeholder={e.actorPlaceholder}
            onCommit={(actor) => onChange(updateStep(process, step.id, { actor }))}
            accessibilityLabel={e.actorLabel}
          />
          {actors.filter((actor) => actor !== step.actor).length > 0 && (
            <View style={styles.options}>
              {actors
                .filter((actor) => actor !== step.actor)
                .map((actor) => (
                  <Pressable
                    key={actor}
                    onPress={() => onChange(updateStep(process, step.id, { actor }))}
                    accessibilityRole="button"
                    accessibilityLabel={e.chooseActor(actor)}
                    style={[styles.option, { backgroundColor: theme.primaryBackground, borderColor: 'transparent' }]}>
                    <ThemedText type="small">{actor}</ThemedText>
                  </Pressable>
                ))}
            </View>
          )}

          <Label text={e.delay} />
          <Field
            value={step.duration !== undefined ? t.format.num(step.duration) : ''}
            placeholder={e.delayPlaceholder}
            keyboardType="decimal-pad"
            onCommit={(text) => {
              const value = text.trim().replace(',', '.');
              onChange(updateStep(process, step.id, { duration: value ? Number(value) : null }));
            }}
            accessibilityLabel={e.delayLabel}
          />

          {exits.length > 0 && <Label text={exits.length > 1 ? e.branches : e.nextStep} />}
          {exits.map((link) => (
            <View key={link.id} style={styles.branch}>
              <View style={styles.branchHead}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {e.to(titleOf(link.to))}
                </ThemedText>
                <Pressable
                  onPress={() => onChange(removeLink(process, link.id))}
                  accessibilityRole="button"
                  accessibilityLabel={e.removeBranch(titleOf(link.to))}
                  hitSlop={8}>
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {e.remove}
                  </ThemedText>
                </Pressable>
              </View>
              {exits.length > 1 && (
                <Field
                  value={link.label ?? ''}
                  placeholder={e.branchPlaceholder}
                  onCommit={(label) => onChange(renameLink(process, link.id, label))}
                  accessibilityLabel={e.branchLabel(titleOf(link.to))}
                />
              )}
            </View>
          ))}
          {exits.length > 1 && step.kind !== 'decision' && (
            <Pressable
              onPress={() => onChange(makeDecision(process, step.id))}
              accessibilityRole="button"
              style={[styles.action, { borderColor: theme.link }]}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                {e.makeDecision(unnamed > 0 ? t.format.count(unnamed, e.branch) : null)}
              </ThemedText>
            </Pressable>
          )}

          {/* Une décision gagne un cas nommé ; une tâche se relie à une étape existante (un retour, par exemple). */}
          {step.kind !== 'end' && (
            <View style={[styles.newCase, { borderColor: theme.border }]}>
              <Label text={isDecision ? e.addCase : e.linkTo} />
              {isDecision && (
                <Field
                  value={caseName}
                  placeholder={e.casePlaceholder}
                  onCommit={setCaseName}
                  accessibilityLabel={e.caseLabel}
                />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {e.leadsTo}
              </ThemedText>
              <View style={styles.options} accessibilityRole="radiogroup">
                {targets.map((target) => {
                  const selected = caseTarget === target.id;
                  return (
                    <Pressable
                      key={target.id ?? 'nouvelle'}
                      onPress={() => setCaseTarget(target.id)}
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
                        {target.title || t.untitled}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={addCase}
                disabled={!canAdd}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd }}
                style={[styles.action, { borderColor: theme.link, opacity: canAdd ? 1 : 0.5 }]}>
                <ThemedText type="smallBold" style={{ color: theme.link }}>
                  {isDecision ? e.addThisCase : e.link}
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.footer}>
            {/* Après une décision, on ajoute un cas (nommé) plutôt qu'une suite anonyme. */}
            {step.kind !== 'decision' && (
              <Pressable
                onPress={addAfter}
                accessibilityRole="button"
                accessibilityHint={e.addAfterHint}
                style={[styles.action, styles.flex, { borderColor: theme.link }]}>
                <ThemedText type="smallBold" style={{ color: theme.link }}>
                  {e.addAfter}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={remove}
              accessibilityRole="button"
              style={[styles.action, { borderColor: theme.danger }]}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                {e.deleteStep}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Champ de saisie : chaque frappe met le brouillon à jour. Le texte tapé est
 * gardé tel quel (une espace en fin de mot n'est pas effacée pendant la frappe).
 */
function Field({
  value,
  onCommit,
  placeholder,
  accessibilityLabel,
  keyboardType,
}: {
  value: string;
  onCommit: (text: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
  keyboardType?: 'decimal-pad';
}) {
  const theme = useTheme();
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Valeur changée ailleurs (un acteur choisi dans la liste, une décision) : on la reprend.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <TextInput
      value={text}
      onChangeText={(next) => {
        setText(next);
        onCommit(next);
      }}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      keyboardType={keyboardType}
      returnKeyType="done"
      accessibilityLabel={accessibilityLabel}
      style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.fieldBorder }]}
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
  content: {
    gap: Spacing.two,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    marginTop: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  number: { width: 22, textAlign: 'center' },
  flex: { flex: 1 },
  form: { gap: Spacing.two, padding: Spacing.three, paddingTop: Spacing.one },
  delays: { paddingTop: Spacing.three },
  input: {
    minHeight: 44,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  branch: { gap: Spacing.one },
  branchHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  newCase: {
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
  },
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
