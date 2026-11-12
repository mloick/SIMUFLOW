import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/badge';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getShownForm, keepSentAnswers } from '@/data/form-preview';
import { useTheme } from '@/hooks/use-theme';
import {
  answerSummary,
  checkAnswers,
  visibleQuestions,
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
  const [form] = useState(getShownForm);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [attempted, setAttempted] = useState(false);
  const [sent, setSent] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

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

        {(form.assignmentGroup || form.tasks.length > 0) && (
          <View style={[styles.notice, { backgroundColor: theme.primaryBackground }]}>
            <SymbolView name={{ ios: 'arrow.right.circle', android: 'arrow_circle_right' }} size={20} tintColor={theme.link} />
            <ThemedText type="small" style={styles.flex}>
              {form.assignmentGroup ? `Le ticket irait à ${form.assignmentGroup}. ` : ''}
              Suivre la demande dans son process arrive dans une prochaine version.
            </ThemedText>
          </View>
        )}

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
        </View>
      </View>

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
              style={[styles.question, { borderTopColor: theme.border }, !shown && styles.hidden]}
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
  submitArea: { gap: Spacing.two },
  center: { textAlign: 'center' },
  hidden: { opacity: 0.45 },
  noticeText: { gap: Spacing.two },
  line: { gap: Spacing.half, padding: Spacing.three },
  actions: { gap: Spacing.two },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  warning: { gap: Spacing.one, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  italic: { fontStyle: 'italic' },
});
