import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
  summarize,
  updateStep,
  type Process,
  type Step,
  type StepKind,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/utils/format';

const KINDS: { value: StepKind; label: string }[] = [
  { value: 'start', label: 'Départ' },
  { value: 'task', label: 'Tâche' },
  { value: 'decision', label: 'Décision' },
  { value: 'end', label: 'Fin' },
];

/**
 * Éditeur d'un process importé : titre, rôle, acteur et délai de chaque étape,
 * noms des branches, étapes et cas ajoutés ou retirés. Les changements restent un brouillon jusqu'à
 * « Enregistrer » ; le diagnostic suit en direct.
 */
export default function EditProcessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const process = getProcess(id);
  const theme = useTheme();

  if (!process || !isImported(id)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title="Process introuvable"
          message="Seuls les process importés se modifient."
          action={{ label: 'Revenir', onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <Editor original={process} />;
}

function Editor({ original }: { original: Process }) {
  const theme = useTheme();
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
    Alert.alert('Abandonner les modifications ?', 'Le process restera tel qu’il était.', [
      { text: 'Continuer à modifier', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Modifier',
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
          {draft.name}
        </ThemedText>
        <ThemedText
          accessibilityLiveRegion="polite"
          style={{ color: toFix > 0 ? (summary.errorCount > 0 ? theme.danger : theme.warning) : theme.success }}>
          {plural(summary.stepCount, 'étape')} · {plural(summary.decisionCount, 'décision')} ·{' '}
          {toFix > 0 ? `${plural(toFix, 'point')} à corriger` : 'aucune anomalie'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Touchez une étape pour la modifier.
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
  const [caseName, setCaseName] = useState('');
  // Cible du nouveau cas : une étape existante, ou une nouvelle étape (undefined).
  const [caseTarget, setCaseTarget] = useState<string | undefined>();
  const exits = process.links.filter((link) => link.from === step.id);
  const titleOf = (id: string) => process.steps.find((other) => other.id === id)?.title || 'Sans titre';
  const unnamed = exits.filter((link) => !link.label?.trim()).length;
  const kindLabel = KINDS.find((kind) => kind.value === step.kind)?.label;
  const others = process.steps.filter((other) => other.id !== step.id);
  const isDecision = step.kind === 'decision';
  const targets: { id: string | undefined; title: string }[] = isDecision
    ? [{ id: undefined, title: 'Une nouvelle étape' }, ...others]
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
    Alert.alert(
      `Supprimer « ${step.title || 'Sans titre'} » ?`,
      links > 0 ? `Ses ${plural(links, 'lien')} partent avec elle.` : 'Elle n’a aucun lien.',
      [
        { text: 'Garder', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onChange(removeStep(process, step.id)) },
      ],
    );
  };

  return (
    <View style={index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Replie l’étape' : 'Ouvre l’étape pour la modifier'}
        style={[styles.row, open && { backgroundColor: theme.primaryBackground }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
          {index + 1}
        </ThemedText>
        <View style={styles.flex}>
          <ThemedText>{step.title || 'Sans titre'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[kindLabel, step.actor, step.duration ? plural(step.duration, 'jour ouvré', 'jours ouvrés') : null]
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
          <Label text="Titre" />
          <Field
            value={step.title}
            onCommit={(title) => onChange(updateStep(process, step.id, { title }))}
            accessibilityLabel="Titre de l’étape"
          />

          <Label text="Rôle" />
          <View style={styles.options} accessibilityRole="radiogroup">
            {KINDS.map((kind) => {
              const selected = step.kind === kind.value;
              return (
                <Pressable
                  key={kind.value}
                  onPress={() => onChange(updateStep(process, step.id, { kind: kind.value }))}
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
                    {kind.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Label text="Acteur" />
          <Field
            value={step.actor ?? ''}
            placeholder="Service, équipe ou rôle"
            onCommit={(actor) => onChange(updateStep(process, step.id, { actor }))}
            accessibilityLabel="Acteur de l’étape"
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
                    accessibilityLabel={`Choisir l’acteur ${actor}`}
                    style={[styles.option, { backgroundColor: theme.primaryBackground, borderColor: 'transparent' }]}>
                    <ThemedText type="small">{actor}</ThemedText>
                  </Pressable>
                ))}
            </View>
          )}

          <Label text="Délai (jours ouvrés)" />
          <Field
            value={step.duration !== undefined ? String(step.duration).replace('.', ',') : ''}
            placeholder="Aucun"
            keyboardType="decimal-pad"
            onCommit={(text) => {
              const value = text.trim().replace(',', '.');
              onChange(updateStep(process, step.id, { duration: value ? Number(value) : null }));
            }}
            accessibilityLabel="Délai de l’étape, en jours ouvrés"
          />

          {exits.length > 0 && <Label text={exits.length > 1 ? 'Branches' : 'Étape suivante'} />}
          {exits.map((link) => (
            <View key={link.id} style={styles.branch}>
              <View style={styles.branchHead}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  Vers « {titleOf(link.to)} »
                </ThemedText>
                <Pressable
                  onPress={() => onChange(removeLink(process, link.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer la branche vers ${titleOf(link.to)}`}
                  hitSlop={8}>
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    Retirer
                  </ThemedText>
                </Pressable>
              </View>
              {exits.length > 1 && (
                <Field
                  value={link.label ?? ''}
                  placeholder="Nom de la branche (oui, non, refus…)"
                  onCommit={(label) => onChange(renameLink(process, link.id, label))}
                  accessibilityLabel={`Nom de la branche vers ${titleOf(link.to)}`}
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
                C’est un choix : en faire une décision
                {unnamed > 0 ? ` et nommer ${plural(unnamed, 'branche')}` : ''}
              </ThemedText>
            </Pressable>
          )}

          {/* Une décision gagne un cas nommé ; une tâche se relie à une étape existante (un retour, par exemple). */}
          {step.kind !== 'end' && (
            <View style={[styles.newCase, { borderColor: theme.border }]}>
              <Label text={isDecision ? 'Ajouter un cas' : 'Relier à une autre étape'} />
              {isDecision && (
                <Field
                  value={caseName}
                  placeholder="Nom du cas (à compléter, urgent…)"
                  onCommit={setCaseName}
                  accessibilityLabel="Nom du nouveau cas"
                />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Mène vers :
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
                        {target.title || 'Sans titre'}
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
                  {isDecision ? 'Ajouter ce cas' : 'Relier'}
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
                accessibilityHint="Crée une étape juste après celle-ci"
                style={[styles.action, styles.flex, { borderColor: theme.link }]}>
                <ThemedText type="smallBold" style={{ color: theme.link }}>
                  Ajouter une étape après
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={remove}
              accessibilityRole="button"
              style={[styles.action, { borderColor: theme.danger }]}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Supprimer l’étape
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
