import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openViewLink, type ViewLinkView } from '@/backend/view-links';
import { Badge } from '@/components/badge';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { Simulator } from '@/components/simulator';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { LinkedWorkflow } from '@/data/form-store';
import type { Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { getT, useT } from '@/i18n';
import {
  answerSummary,
  checkAnswers,
  chosenSituation,
  situationName,
  situationToProcess,
  visibleQuestions,
  type FormAnswer,
  type FormAnswers,
  type FormTemplate,
} from '@/import/tableau';

/** Largeur à partir de laquelle le guide se met à côté de la simulation, et plus au-dessus. */
const SIDE_GUIDE_WIDTH = 900;

/**
 * Page d'un lien de consultation, ouverte dans le navigateur, sans compte :
 * un formulaire à essayer, un workflow simulé, ou le formulaire puis le
 * workflow qui le suit, avec un petit guide adapté. Lecture seule : rien de
 * ce que la personne tape n'est envoyé ni enregistré.
 */
export default function ViewLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const t = useT();
  const v = t.viewLink;
  const [view, setView] = useState<ViewLinkView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openViewLink(token ?? '').then(setView, (cause: unknown) =>
      setError(cause instanceof Error ? cause.message : getT().viewLink.openError),
    );
  }, [token]);

  if (error) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: t.titles.view }} />
        <StateMessage
          icon={{ ios: 'link', android: 'link_off' }}
          tone="danger"
          title={error === t.errors.linkExpired ? v.expired : v.notFound}
          message={error}
          action={{ label: v.openApp, onPress: () => router.replace('/') }}
        />
      </View>
    );
  }
  if (!view) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: t.titles.view }} />
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }
  return <Viewer view={view} />;
}

function Viewer({ view }: { view: ViewLinkView }) {
  // Le workflow simulé : celui du lien, ou celui choisi par les réponses au formulaire.
  const [process, setProcess] = useState<Process | null>(() =>
    view.kind === 'workflow' && view.workflow?.kind === 'process' ? view.workflow.process : null,
  );
  if (process) {
    return (
      <WorkflowStage
        view={view}
        process={process}
        onBack={
          view.kind === 'form_workflow' || view.workflow?.kind === 'situations' ? () => setProcess(null) : undefined
        }
      />
    );
  }
  if (view.form) return <FormStage view={view} form={view.form} onSimulate={setProcess} />;
  // Un workflow seul fait de plusieurs situations : on en choisit une.
  return <SituationPicker view={view} onPick={setProcess} />;
}

/** Le guide : qui envoie, jusqu'à quand, son mot, et comment lire la page. */
function Guide({ view, steps, collapsible }: { view: ViewLinkView; steps: readonly string[]; collapsible: boolean }) {
  const theme = useTheme();
  const t = useT();
  const v = t.viewLink;
  const [open, setOpen] = useState(!collapsible);
  return (
    <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {open && (
        <>
          <View style={styles.badges}>
            <Badge label={v.kinds[view.kind]} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {v.from(view.ownerName)} · {v.until(new Date(view.expiresAt))}
          </ThemedText>
        </>
      )}
      {view.note && open && (
        <View style={[styles.note, { backgroundColor: theme.primaryBackground }]}>
          <ThemedText type="smallBold">{v.noteTitle}</ThemedText>
          <ThemedText type="small">{view.note}</ThemedText>
        </View>
      )}
      {collapsible && (
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          style={styles.row}>
          <SymbolView name={{ ios: 'questionmark.circle', android: 'help' }} size={18} tintColor={theme.link} />
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {open ? v.guideHide : view.note ? v.guideShowWithNote : v.guideShow}
          </ThemedText>
        </Pressable>
      )}
      {open && (
        <View style={styles.steps}>
          {!collapsible && (
            <ThemedText type="smallBold" accessibilityRole="header">
              {v.guideTitle}
            </ThemedText>
          )}
          {steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryBackground }]}>
                <ThemedText type="smallBold" style={{ color: theme.link }}>
                  {index + 1}
                </ThemedText>
              </View>
              <ThemedText type="small" style={styles.flex}>
                {step}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Le workflow simulé, avec le guide à côté (grand écran) ou au-dessus, repliable (téléphone). */
function WorkflowStage({ view, process, onBack }: { view: ViewLinkView; process: Process; onBack?: () => void }) {
  const theme = useTheme();
  const t = useT();
  const v = t.viewLink;
  const { width } = useWindowDimensions();
  const side = width >= SIDE_GUIDE_WIDTH;
  const back = onBack && (
    <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={styles.backLink}>
      <ThemedText type="smallBold" style={{ color: theme.link }}>
        {view.form ? v.backToForm : v.otherSituation}
      </ThemedText>
    </Pressable>
  );
  const guide = <Guide view={view} steps={v.guide.workflow} collapsible={!side} />;
  if (side) {
    return (
      <View style={[styles.screen, styles.sideBySide, { backgroundColor: theme.background }]}>
        <ScrollView style={styles.sidePanel} contentContainerStyle={styles.sideContent}>
          <ThemedText type="subtitle">{view.title}</ThemedText>
          {guide}
          {back}
        </ScrollView>
        <View style={styles.flex}>
          <Simulator process={process} exportable={false} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.topGuide}>
        {guide}
        {back}
      </View>
      <View style={styles.flex}>
        <Simulator process={process} exportable={false} />
      </View>
    </View>
  );
}

/** Le formulaire à essayer : mêmes règles que l'écran Formulaire de l'app, sans rien garder. */
function FormStage({
  view,
  form,
  onSimulate,
}: {
  view: ViewLinkView;
  form: FormTemplate;
  onSimulate: (process: Process) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const v = t.viewLink;
  const f = t.form;
  const { count } = t.format;
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [attempted, setAttempted] = useState(false);
  const [sent, setSent] = useState(false);

  const visible = useMemo(() => new Set(visibleQuestions(form.questions, answers).map((q) => q.n)), [form, answers]);
  const problems = useMemo(
    () => (attempted ? checkAnswers(form.questions, answers, t) : new Map<number, string>()),
    [form, answers, attempted, t],
  );
  const steps = view.workflow ? v.guide.formThenWorkflow : v.guide.form;

  const answer = (n: number, value: FormAnswer) => setAnswers((current) => ({ ...current, [n]: value }));
  const send = () => {
    setAttempted(true);
    if (checkAnswers(form.questions, answers).size > 0) return;
    setSent(true);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const restart = () => {
    setAnswers({});
    setAttempted(false);
    setSent(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const header = <Stack.Screen options={{ title: view.title }} />;

  if (sent) {
    const lines = answerSummary(form.questions, answers);
    const next = nextProcess(form, view.workflow, answers);
    return (
      <ScrollView
        ref={scroll}
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        {header}
        <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.row}>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={28} tintColor={theme.success} />
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.flex}>
              {v.sentTitle}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">{v.sentText}</ThemedText>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {lines.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
              {f.noAnswer}
            </ThemedText>
          )}
          {lines.map((line, index) => (
            <View
              key={line.n}
              style={[styles.line, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {line.label}
              </ThemedText>
              <ThemedText>{line.answer}</ThemedText>
            </View>
          ))}
        </View>
        {view.workflow &&
          (next ? (
            <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {f.next}
              </ThemedText>
              <ThemedText type="subtitle">{next.name}</ThemedText>
              <PrimaryButton label={v.seeWorkflow} onPress={() => onSimulate(next)} />
            </View>
          ) : (
            <ThemedText style={{ color: theme.warning }}>{v.noWorkflowFor}</ThemedText>
          ))}
        <View style={styles.actions}>
          <Pressable onPress={() => setSent(false)} accessibilityRole="button" style={styles.secondary}>
            <ThemedText type="link" style={{ color: theme.link }}>
              {f.editAnswers}
            </ThemedText>
          </Pressable>
          <Pressable onPress={restart} accessibilityRole="button" style={styles.secondary}>
            <ThemedText type="link" style={{ color: theme.link }}>
              {v.tryAgain}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: theme.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
      {header}
      <Guide view={view} steps={steps} collapsible={false} />
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.formHeader}>
          <ThemedText type="subtitle" accessibilityRole="header">
            {form.name ?? view.title}
          </ThemedText>
          {form.description && <ThemedText themeColor="textSecondary">{form.description}</ThemedText>}
          <View style={styles.badges}>
            {form.ticketType && <Badge label={form.ticketType} />}
            <Badge label={count(form.questions.length, t.words.question)} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="small" style={{ color: theme.danger }}>
              *
            </ThemedText>{' '}
            {f.required}
          </ThemedText>
        </View>
        {form.questions
          .filter((question) => visible.has(question.n))
          .map((question) => (
            <View
              key={question.n}
              style={[
                styles.question,
                { borderTopColor: theme.border },
                question.partOf !== undefined && [styles.complement, { borderLeftColor: theme.primaryBackground }],
              ]}>
              <FormField
                question={question}
                questions={form.questions}
                value={answers[question.n]}
                onChange={(value) => answer(question.n, value)}
                error={problems.get(question.n)}
              />
            </View>
          ))}
        {form.questions.length > 0 && (
          <View style={[styles.question, styles.submit, { borderTopColor: theme.border }]}>
            {problems.size > 0 && (
              <ThemedText type="smallBold" style={[styles.centerText, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {f.toFix(count(problems.size, f.answer))}
              </ThemedText>
            )}
            <PrimaryButton label={f.send} onPress={send} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/** Le workflow qui suit le formulaire rempli : le process lié, ou la situation choisie par les réponses. */
function nextProcess(form: FormTemplate, workflow: LinkedWorkflow | null, answers: FormAnswers): Process | null {
  if (!workflow) return null;
  if (workflow.kind === 'process') return workflow.process;
  const chosen = chosenSituation(form, workflow.situations, answers);
  if (chosen.kind !== 'situation') return null;
  return situationToProcess(workflow.situations[chosen.index], `lien-situation-${chosen.index + 1}`);
}

/** Un workflow seul, fait de plusieurs situations (classeur SLA / OLA) : on choisit celle à simuler. */
function SituationPicker({ view, onPick }: { view: ViewLinkView; onPick: (process: Process) => void }) {
  const theme = useTheme();
  const t = useT();
  const v = t.viewLink;
  const situations = view.workflow?.kind === 'situations' ? view.workflow.situations : [];
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: view.title }} />
      <Guide view={view} steps={v.guide.workflow} collapsible={false} />
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {v.pickSituation}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {situations.map((situation, index) => (
          <Pressable
            key={index}
            onPress={() => onPick(situationToProcess(situation, `lien-situation-${index + 1}`))}
            accessibilityRole="button"
            style={[styles.line, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <ThemedText style={{ color: theme.link }}>{situationName(situation)}</ThemedText>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  flex: { flex: 1 },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: Radius.large, overflow: 'hidden' },
  padded: { padding: Spacing.three, gap: Spacing.two },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  note: { gap: Spacing.half, padding: Spacing.three, borderRadius: Radius.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  steps: { gap: Spacing.two },
  step: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  formHeader: { gap: Spacing.two, padding: Spacing.three },
  question: { padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  complement: { borderTopWidth: 0, paddingTop: 0, marginLeft: Spacing.three, borderLeftWidth: 2 },
  submit: { gap: Spacing.two },
  centerText: { textAlign: 'center' },
  line: { gap: Spacing.half, padding: Spacing.three },
  actions: { gap: Spacing.two },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backLink: { minHeight: 44, justifyContent: 'center' },
  sideBySide: { flexDirection: 'row' },
  sidePanel: { width: 340, flexGrow: 0 },
  sideContent: { gap: Spacing.three, padding: Spacing.three },
  topGuide: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.one },
});
