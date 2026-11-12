import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/badge';
import { FormField, type FormAnswer } from '@/components/form-field';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getShownForm } from '@/data/form-preview';
import { useTheme } from '@/hooks/use-theme';
import type { FormWarning } from '@/import/tableau';
import { plural } from '@/utils/format';

const TONES: Record<FormWarning['level'], BadgeTone> = { rouge: 'danger', orange: 'warning', info: 'neutral' };
const LEVELS: Record<FormWarning['level'], string> = { rouge: 'À corriger', orange: 'À vérifier', info: 'Info' };

/**
 * « Aperçu du formulaire » : le formulaire décrit par un template, tel que le
 * demandeur le verra sur le portail de demande. Chaque question est dessinée
 * selon son type ; celles qui ne s'affichent que sous condition le disent.
 * Les champs se touchent déjà, mais rien n'est envoyé ni gardé.
 */
export default function FormScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [form] = useState(getShownForm);
  const [answers, setAnswers] = useState<Record<number, FormAnswer>>({});

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

  const conditional = form.questions.filter((question) => question.conditions.length > 0).length;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
      <View style={[styles.notice, { backgroundColor: theme.primaryBackground }]}>
        <SymbolView name={{ ios: 'eye', android: 'visibility' }} size={20} tintColor={theme.link} />
        <ThemedText type="small" style={styles.flex}>
          Aperçu : le formulaire tel que le demandeur le verra.{' '}
          {conditional > 0 && `${plural(conditional, 'question')} ne s’affiche${conditional > 1 ? 'nt' : ''} que selon une réponse. `}
          Rien n’est envoyé.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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

        {form.questions.map((question) => (
          <View key={question.n} style={[styles.question, { borderTopColor: theme.border }]}>
            <FormField
              question={question}
              questions={form.questions}
              value={answers[question.n]}
              onChange={(value) => setAnswers((current) => ({ ...current, [question.n]: value }))}
            />
          </View>
        ))}

        {form.questions.length > 0 && (
          <View style={[styles.question, { borderTopColor: theme.border }]}>
            <View style={[styles.submit, { backgroundColor: theme.surfaceMuted }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Envoyer la demande
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              L’envoi et la suite de la demande arrivent dans une prochaine version.
            </ThemedText>
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
  submit: { minHeight: 48, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center', marginTop: Spacing.two },
  section: { gap: Spacing.two },
  warning: { gap: Spacing.one, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  italic: { fontStyle: 'italic' },
});
