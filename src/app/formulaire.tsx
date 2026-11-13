import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnonymizeOption } from '@/components/anonymize-option';
import { Badge, type BadgeTone } from '@/components/badge';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { situationMeta } from '@/components/situation-list';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { processForForm, readWorkflowFile, startFormTracking } from '@/data/form-chain';
import {
  anonymizeShown,
  keepSentAnswers,
  markShownSaved,
  saveForm,
  setShownWorkflow,
  useShownForm,
  type LinkedWorkflow,
} from '@/data/form-store';
import { parseHiddenWords, type Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { ImportError } from '@/import';
import {
  answerSummary,
  checkAnswers,
  chosenSituation,
  findFormLink,
  situationName,
  visibleQuestions,
  VARIANT_LABELS,
  type AnswerLine,
  type FormTemplate,
  type FormAnswer,
  type FormAnswers,
  type FormWarning,
} from '@/import/tableau';
import { plural } from '@/utils/format';

const TONES: Record<FormWarning['level'], BadgeTone> = { rouge: 'danger', orange: 'warning', info: 'neutral' };
const LEVELS: Record<FormWarning['level'], string> = { rouge: 'À corriger', orange: 'À vérifier', info: 'Info' };

/**
 * « Formulaire » : le formulaire décrit par un template, tel que le
 * demandeur le verra sur le portail de demande, et qu'on peut remplir. Les
 * questions conditionnelles apparaissent selon les réponses ; « Envoyer la
 * demande » vérifie les réponses obligatoires et les formats, puis montre le
 * récapitulatif. Rien n'est envoyé : c'est une simulation.
 */
export default function FormScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const positions = useRef(new Map<number, number>());
  const cardTop = useRef(0);
  const shown = useShownForm();
  const form = shown?.form ?? null;
  const workflow = shown?.workflow ?? null;
  const [savedId, setSavedId] = useState<string | null>(shown?.savedId ?? null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [attempted, setAttempted] = useState(false);
  const [sent, setSent] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenWords, setHiddenWords] = useState(shown?.anonymous?.hidden.join(', ') ?? '');

  // Formulaire modifié dans l'éditeur : les réponses repartent de zéro.
  const [formSeen, setFormSeen] = useState(form);
  if (form !== formSeen) {
    setFormSeen(form);
    setAnswers({});
    setAttempted(false);
    setSent(false);
  }

  const visible = useMemo(() => new Set(form ? visibleQuestions(form.questions, answers).map((q) => q.n) : []), [form, answers]);
  const problems = useMemo(
    () => (form && attempted ? checkAnswers(form.questions, answers) : new Map<number, string>()),
    [form, answers, attempted],
  );

  if (!form) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'doc.text', android: 'description' }}
          tone="primary"
          action={{ label: 'Fermer', onPress: () => router.back() }}
          title="Aucun formulaire à afficher"
          message="Importez un template de formulaire (Excel) depuis « Nouveau process »."
        />
      </View>
    );
  }

  const hidden = form.questions.length - visible.size;

  /** Lier un workflow : un classeur SLA / OLA dont les situations sont des choix du formulaire, ou un process. */
  const pickWorkflow = async () => {
    const selection = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (selection.canceled) return;
    try {
      const next = await readWorkflowFile(selection.assets[0]);
      if (next.kind === 'situations' && !findFormLink(form, next.situations)) {
        throw new ImportError('Aucun choix du formulaire ne porte le nom d’une situation de ce workflow : le lien est impossible.');
      }
      setShownWorkflow(next);
      setLinkError(null);
    } catch (cause) {
      setLinkError(cause instanceof ImportError ? cause.message : 'Le fichier n’a pas pu être lu.');
    }
  };
  const unlink = () => setShownWorkflow(null);
  /** Anonymiser : les groupes deviennent Service A, B…, partout, workflow compris. */
  const toggleAnonymous = () => anonymizeShown(shown?.anonymous ? null : parseHiddenWords(hiddenWords));
  const changeHiddenWords = (value: string) => {
    setHiddenWords(value);
    if (shown?.anonymous) anonymizeShown(parseHiddenWords(value));
  };
  const keep = () => {
    const id = saveForm(form, shown?.source ?? '', workflow);
    markShownSaved(id);
    setSavedId(id);
  };
  const workflowCard = (
    <WorkflowCard
      form={form}
      workflow={workflow}
      saved={savedId !== null}
      error={linkError}
      onPick={pickWorkflow}
      onUnlink={unlink}
      onKeep={keep}
    />
  );

  const answer = (n: number, value: FormAnswer) => setAnswers((current) => ({ ...current, [n]: value }));

  const send = () => {
    setAttempted(true);
    const found = checkAnswers(form.questions, answers);
    if (found.size > 0) {
      const first = Math.min(...found.keys());
      scroll.current?.scrollTo({ y: Math.max(0, cardTop.current + (positions.current.get(first) ?? 0) - Spacing.three), animated: true });
      return;
    }
    // Seules les réponses aux questions affichées partent avec la demande.
    keepSentAnswers(Object.fromEntries(Object.entries(answers).filter(([n]) => visible.has(Number(n)))));
    setSent(true);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const restart = () => {
    setAnswers({});
    setAttempted(false);
    setSent(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (sent) {
    const lines = answerSummary(form.questions, answers);
    return (
      <ScrollView
        ref={scroll}
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.row}>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={28} tintColor={theme.success} />
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.flex}>
              Demande prête
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">
            {form.name ? `Le formulaire « ${form.name} »` : 'Le formulaire'} est rempli correctement. Rien n’a été envoyé : c’est une simulation.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
            Récapitulatif ({plural(lines.length, 'réponse')})
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {lines.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
                Aucune réponse donnée.
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
        </View>

        {shown && (
          <NextStep
            form={form}
            workflow={workflow}
            lines={lines}
            answers={answers}
            run={(index) => processForForm({ ...shown, workflow }, index)}
          />
        )}

        {workflowCard}

        <View style={styles.actions}>
          <PrimaryButton label="Modifier les réponses" onPress={() => setSent(false)} />
          <Pressable onPress={restart} accessibilityRole="button" style={styles.secondary}>
            <ThemedText type="link" style={{ color: theme.link }}>
              Nouvelle demande
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
      <View style={[styles.notice, { backgroundColor: theme.primaryBackground }]}>
        <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note' }} size={20} tintColor={theme.link} />
        <View style={[styles.flex, styles.noticeText]}>
          <ThemedText type="small">
            Remplissez le formulaire comme le demandeur.{' '}
            {hidden > 0 && `${plural(hidden, 'question')} ${hidden > 1 ? 'apparaîtront' : 'apparaîtra'} selon vos réponses. `}
            Rien n’est envoyé.
          </ThemedText>
          {hidden > 0 && (
            <Pressable
              onPress={() => setShowHidden(!showHidden)}
              accessibilityRole="switch"
              accessibilityState={{ checked: showHidden }}
              hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                {showHidden ? 'Masquer les questions cachées' : 'Montrer aussi les questions cachées'}
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/formulaire-modifier')}
            accessibilityRole="button"
            accessibilityHint="Ajouter, retirer ou corriger des questions, des pièces jointes et des conditions"
            hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.link }}>
              Modifier le formulaire
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AnonymizeOption
          checked={!!shown?.anonymous}
          onToggle={toggleAnonymous}
          hidden={hiddenWords}
          onChangeHidden={changeHiddenWords}
          label="Anonymiser le formulaire"
          description="Groupes et services → Service A, B…, dans le formulaire et son workflow ; e-mails, téléphones et liens masqués"
          result={
            shown?.anonymous
              ? `${plural(shown.anonymous.actorCount, 'groupe renommé', 'groupes renommés')}${savedId ? ' · le formulaire gardé suit' : ''}`
              : undefined
          }
        />
      </View>

      {workflowCard}

      <View
        onLayout={(event) => (cardTop.current = event.nativeEvent.layout.y)}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header">
            {form.name ?? 'Formulaire sans nom'}
          </ThemedText>
          {form.description && <ThemedText themeColor="textSecondary">{form.description}</ThemedText>}
          <View style={styles.badges}>
            {form.ticketType && <Badge label={form.ticketType} />}
            <Badge label={plural(form.questions.length, 'question')} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="small" style={{ color: theme.danger }}>
              *
            </ThemedText>{' '}
            Réponse obligatoire
          </ThemedText>
        </View>

        {form.questions.map((question) => {
          const shown = visible.has(question.n);
          if (!shown && !showHidden) return null;
          return (
            <View
              key={question.n}
              onLayout={(event) => positions.current.set(question.n, event.nativeEvent.layout.y)}
              style={[
                styles.question,
                { borderTopColor: theme.border },
                // Un complément (description du fichier, précision…) fait corps avec sa question.
                question.partOf !== undefined && [styles.complement, { borderLeftColor: theme.primaryBackground }],
                !shown && styles.hidden,
              ]}
              accessibilityElementsHidden={!shown}
              importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
              pointerEvents={shown ? 'auto' : 'none'}>
              <FormField
                question={question}
                questions={form.questions}
                value={answers[question.n]}
                onChange={(value) => answer(question.n, value)}
                error={shown ? problems.get(question.n) : null}
              />
            </View>
          );
        })}

        {form.questions.length > 0 && (
          <View style={[styles.question, styles.submitArea, { borderTopColor: theme.border }]}>
            {problems.size > 0 && (
              <ThemedText type="smallBold" style={[styles.center, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {plural(problems.size, 'réponse')} à corriger avant l’envoi.
              </ThemedText>
            )}
            <PrimaryButton label="Envoyer la demande" onPress={send} />
          </View>
        )}
      </View>

      {(form.assignmentGroup || form.tasks.length > 0) && (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
            Après l’envoi
          </ThemedText>
          <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {form.assignmentGroup && <ThemedText>Ticket attribué à {form.assignmentGroup}</ThemedText>}
            {form.summary && (
              <ThemedText type="small" themeColor="textSecondary">
                Résumé : {form.summary}
              </ThemedText>
            )}
            {form.tasks.map((task) => (
              <ThemedText key={task.n} type="small">
                Task {task.sequence ?? task.n} : {task.description ?? 'sans titre'}
                {task.group ? ` · ${task.group}` : ''}
              </ThemedText>
            ))}
          </View>
        </View>
      )}

      {form.warnings.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
            Points à vérifier dans le template
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {form.warnings.map((warning, index) => (
              <View
                key={`${warning.cell}-${index}`}
                style={[styles.warning, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.row}>
                  <Badge label={LEVELS[warning.level]} tone={TONES[warning.level]} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {warning.sheet}
                    {warning.cell ? ` · ${warning.cell}` : ''}
                  </ThemedText>
                </View>
                <ThemedText type="small">{warning.message}</ThemedText>
                {warning.question && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.italic}>
                    Question à poser : {warning.question}
                  </ThemedText>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/** Le workflow lié au formulaire : ce qui suit l'envoi. Lier, changer, retirer ; garder le formulaire. */
function WorkflowCard({
  form,
  workflow,
  saved,
  error,
  onPick,
  onUnlink,
  onKeep,
}: {
  form: FormTemplate;
  workflow: LinkedWorkflow | null;
  saved: boolean;
  error: string | null;
  onPick: () => void;
  onUnlink: () => void;
  onKeep: () => void;
}) {
  const theme = useTheme();
  const link = workflow?.kind === 'situations' ? findFormLink(form, workflow.situations) : null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Workflow lié
      </ThemedText>
      <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <SymbolView
            name={workflow ? { ios: 'link', android: 'link' } : { ios: 'doc.text', android: 'description' }}
            size={20}
            tintColor={workflow ? theme.link : theme.textSecondary}
          />
          <ThemedText type="smallBold" style={styles.flex}>
            {workflow ? workflow.source || 'Workflow' : 'Formulaire seul'}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {workflow?.kind === 'situations'
            ? `${plural(workflow.situations.length, 'situation')}. La réponse à « ${link?.question.label.split('\n')[0] ?? '?'} » choisit le process qui suit la demande (${plural(link?.linked ?? 0, 'choix relié', 'choix reliés')}).`
            : workflow
              ? `Process « ${workflow.process.name} » : il suit chaque demande envoyée.`
              : 'Aucun workflow : la simulation s’arrête au formulaire. Liez un classeur SLA / OLA, un schéma draw.io ou un tableau de process pour que la demande continue dans son process.'}
        </ThemedText>
        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        )}
        <View style={styles.links}>
          <Pressable onPress={onPick} accessibilityRole="button" hitSlop={8} style={styles.linkButton}>
            <ThemedText type="link" style={{ color: theme.link }}>
              {workflow ? 'Changer de workflow' : 'Lier un workflow'}
            </ThemedText>
          </Pressable>
          {workflow && (
            <Pressable onPress={onUnlink} accessibilityRole="button" hitSlop={8} style={styles.linkButton}>
              <ThemedText type="link" style={{ color: theme.danger }}>
                Retirer le lien
              </ThemedText>
            </Pressable>
          )}
        </View>
        <View style={[styles.keep, { borderTopColor: theme.border }]}>
          {saved ? (
            <ThemedText type="small" themeColor="textSecondary">
              Gardé : retrouvez-le dans Profil, « Mes formulaires ».
            </ThemedText>
          ) : (
            <Pressable onPress={onKeep} accessibilityRole="button" hitSlop={8} style={styles.linkButton}>
              <ThemedText type="link" style={{ color: theme.link }}>
                Garder ce formulaire{workflow ? ' et son workflow' : ''}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/** Après « Demande prête » : la situation choisie et son process, à simuler ou à suivre en vrai. */
function NextStep({
  form,
  workflow,
  lines,
  answers,
  run,
}: {
  form: FormTemplate;
  workflow: LinkedWorkflow | null;
  lines: AnswerLine[];
  answers: FormAnswers;
  /** Crée (une fois) le process qui suit, pour la situation `index` ou le process lié. */
  run: (index: number | null) => Process | null;
}) {
  const theme = useTheme();
  if (!workflow) {
    return (
      <View style={[styles.notice, { backgroundColor: theme.primaryBackground }]}>
        <SymbolView name={{ ios: 'info.circle', android: 'info' }} size={20} tintColor={theme.link} />
        <ThemedText type="small" style={styles.flex}>
          {form.assignmentGroup ? `Le ticket irait à ${form.assignmentGroup}. ` : ''}
          Ce formulaire n’est lié à aucun workflow : la simulation s’arrête ici. Liez-en un plus bas pour suivre la demande dans son process.
        </ThemedText>
      </View>
    );
  }

  const chosen = workflow.kind === 'situations' ? chosenSituation(form, workflow.situations, answers) : null;
  const index = chosen?.kind === 'situation' ? chosen.index : null;
  const situation = index !== null && workflow.kind === 'situations' ? workflow.situations[index] : null;
  const ready = workflow.kind === 'process' || situation !== null;

  const simulate = () => {
    const process = run(index);
    if (process) router.push({ pathname: '/simulation/[id]', params: { id: process.id } });
  };
  const track = () => {
    const process = run(index);
    if (!process) return;
    const id = startFormTracking(process, form.name ?? 'Demande', lines, workflow.kind === 'situations');
    if (id) router.push({ pathname: '/suivi/[id]', params: { id } });
  };

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        La suite de la demande
      </ThemedText>
      <View style={[styles.card, styles.padded, { backgroundColor: theme.surface, borderColor: ready ? theme.primary : theme.border }]}>
        {chosen?.kind === 'situation' && situation && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Réponse « {chosen.option} » : la situation du workflow
            </ThemedText>
            <ThemedText type="subtitle">{situationName(situation)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {situationMeta(situation)} · {VARIANT_LABELS[situation.variant]}
            </ThemedText>
          </>
        )}
        {chosen?.kind === 'unmatched' && (
          <ThemedText style={{ color: theme.warning }}>
            La réponse « {chosen.option} » ne correspond à aucune situation du workflow : rien ne suit.
          </ThemedText>
        )}
        {chosen?.kind === 'unanswered' && (
          <ThemedText style={{ color: theme.warning }}>Aucune situation choisie dans le formulaire : rien ne suit.</ThemedText>
        )}
        {chosen?.kind === 'no-link' && (
          <ThemedText style={{ color: theme.warning }}>Aucun choix du formulaire ne correspond aux situations du workflow.</ThemedText>
        )}
        {workflow.kind === 'process' && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Le process lié
            </ThemedText>
            <ThemedText type="subtitle">{workflow.process.name}</ThemedText>
          </>
        )}
        {ready && (
          <View style={styles.actions}>
            <PrimaryButton label="Simuler le parcours" onPress={simulate} />
            <Pressable onPress={track} accessibilityRole="button" style={styles.secondary}>
              <ThemedText type="link" style={{ color: theme.link }}>
                Suivre la demande en vrai
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.medium },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  padded: { padding: Spacing.three, gap: Spacing.one },
  header: { gap: Spacing.two, padding: Spacing.three },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  question: { padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  complement: { borderTopWidth: 0, paddingTop: 0, marginLeft: Spacing.three, borderLeftWidth: 2 },
  submitArea: { gap: Spacing.two },
  center: { textAlign: 'center' },
  hidden: { opacity: 0.45 },
  noticeText: { gap: Spacing.two },
  line: { gap: Spacing.half, padding: Spacing.three },
  actions: { gap: Spacing.two },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  linkButton: { minHeight: 44, justifyContent: 'center' },
  keep: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  section: { gap: Spacing.two },
  warning: { gap: Spacing.one, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  italic: { fontStyle: 'italic' },
});
