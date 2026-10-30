import { SymbolView } from 'expo-symbols';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess, isImported, isInCloud, removeImportedProcess } from '@/data/process-store';
import { countPaths, explainIssue, summarize, type Issue, type Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/utils/format';

const SOURCE_TEXT = {
  drawio: 'Importé depuis draw.io',
  scan: 'Créé à partir d’un tableau scanné',
  json: 'Importé depuis un fichier JSON',
};

/**
 * Détail d'un process (maquette, écran 3) : chiffres clés, acteurs, diagnostic
 * et liste des étapes. « Voir » fait défiler jusqu'à l'étape concernée.
 */
export default function ProcessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const process = getProcess(id);
  const theme = useTheme();

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title="Process introuvable"
          message="Ce process n’existe plus ou n’a pas encore été synchronisé."
          action={{ label: 'Revenir à la liste', onPress: () => router.back() }}
        />
      </View>
    );
  }

  return <ProcessDetail process={process} />;
}

function ProcessDetail({ process }: { process: Process }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const stepY = useRef(new Map<string, number>());
  // Position de la carte « Étapes » dans la page : celle de sa section plus
  // son décalage sous le titre de section.
  const sectionY = useRef(0);
  const cardY = useRef(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const summary = useMemo(() => summarize(process), [process]);
  const paths = useMemo(() => countPaths(process), [process]);
  const toFix = summary.errorCount + summary.warningCount;
  const shown = summary.issues.filter((issue) => issue.severity !== 'info');
  const folded = summary.issues.filter((issue) => issue.severity === 'info');

  const showStep = (stepId: string) => {
    const y = stepY.current.get(stepId);
    if (y !== undefined)
      scrollRef.current?.scrollTo({ y: sectionY.current + cardY.current + y - Spacing.four, animated: true });
    setHighlighted(stepId);
  };

  const share = () =>
    Share.share({
      message: `${process.name} : ${plural(summary.stepCount, 'étape')}, ${plural(toFix, 'point')} à corriger (SimuFlow).`,
    });

  const confirmDelete = () =>
    Alert.alert(
      'Supprimer ce process ?',
      isInCloud(process.id)
        ? `« ${process.name} » sera retiré de ce téléphone et de votre compte.`
        : `« ${process.name} » sera retiré de ce téléphone.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            removeImportedProcess(process.id);
            router.back();
          },
        },
      ],
    );

  const fixTone = summary.errorCount > 0 ? 'danger' : summary.warningCount > 0 ? 'warning' : 'success';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerBackTitle: 'Process',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerRight: () => (
            <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Partager" hitSlop={12}>
              <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share' }} size={22} tintColor={theme.link} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.titleBlock}>
          <ThemedText type="title" accessibilityRole="header">
            {process.name}
          </ThemedText>
          {process.source && <ThemedText themeColor="textSecondary">{SOURCE_TEXT[process.source]}</ThemedText>}
        </View>

        <View style={styles.stats}>
          <StatTile value={summary.stepCount} label={summary.stepCount > 1 ? 'étapes' : 'étape'} />
          <StatTile value={summary.decisionCount} label={summary.decisionCount > 1 ? 'décisions' : 'décision'} />
          <StatTile
            value={paths.capped ? `${paths.count}+` : paths.count}
            label={paths.count > 1 ? 'chemins possibles' : 'chemin possible'}
          />
          <StatTile value={toFix} label={toFix > 1 ? 'points à corriger' : 'point à corriger'} tone={fixTone} />
        </View>

        {summary.actors.length > 0 && (
          <Section title="Acteurs">
            <View style={styles.chips}>
              {summary.actors.map((actor) => (
                <View key={actor} style={[styles.chip, { backgroundColor: theme.primaryBackground }]}>
                  <ThemedText>{actor}</ThemedText>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Diagnostic">
          <DiagnosticCard process={process} shown={shown} folded={folded} onShow={showStep} />
        </Section>

        <View onLayout={(e) => (sectionY.current = e.nativeEvent.layout.y)}>
          <Section title="Étapes">
            <View
              onLayout={(e) => (cardY.current = e.nativeEvent.layout.y)}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {process.steps.map((step, index) => (
                <View
                  key={step.id}
                  onLayout={(e) => stepY.current.set(step.id, e.nativeEvent.layout.y)}
                  accessible
                  style={[
                    styles.step,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    highlighted === step.id && { backgroundColor: theme.primaryBackground },
                  ]}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.stepNumber}>
                    {index + 1}
                  </ThemedText>
                  <View style={styles.stepText}>
                    <ThemedText>{step.title || 'Sans titre'}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[
                        KIND_LABELS[step.kind],
                        step.actor,
                        step.duration ? plural(step.duration, 'jour ouvré', 'jours ouvrés') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        </View>

        {isImported(process.id) && (
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityHint="Demande une confirmation"
            style={({ pressed }) => [
              styles.delete,
              { backgroundColor: pressed ? theme.dangerBackground : 'transparent' },
            ]}>
            <SymbolView name={{ ios: 'trash', android: 'delete' }} size={18} tintColor={theme.danger} />
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              Supprimer ce process
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three, backgroundColor: theme.background }]}>
        <PrimaryButton
          label="▶  Lancer la simulation"
          accessibilityLabel="Lancer la simulation"
          onPress={() => router.push({ pathname: '/simulation/[id]', params: { id: process.id } })}
        />
      </View>
    </View>
  );
}

const KIND_LABELS = { start: 'Départ', task: 'Tâche', decision: 'Décision', end: 'Fin' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function StatTile({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const theme = useTheme();
  const color = tone ? theme[tone] : theme.text;
  const background = tone ? theme[`${tone}Background`] : theme.surface;

  return (
    <View style={[styles.tile, { backgroundColor: background, borderColor: theme.border }]} accessible>
      <ThemedText type="title" style={{ color }}>
        {value}
      </ThemedText>
      <ThemedText style={{ color: tone ? color : theme.textSecondary }}>{label}</ThemedText>
    </View>
  );
}

function DiagnosticCard({
  process,
  shown,
  folded,
  onShow,
}: {
  process: Process;
  shown: Issue[];
  folded: Issue[];
  onShow: (stepId: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const visible = open ? [...shown, ...folded] : shown;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {shown.length === 0 && (
        <View style={styles.issue}>
          <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle' }} size={22} tintColor={theme.success} />
          <ThemedText style={[styles.issueText, { color: theme.success }]}>Aucune anomalie</ThemedText>
        </View>
      )}
      {visible.map((issue, index) => {
        const { title, detail } = explainIssue(issue, process);
        const color =
          issue.severity === 'error'
            ? theme.danger
            : issue.severity === 'warning'
              ? theme.warning
              : theme.textSecondary;
        const icon =
          issue.severity === 'error'
            ? ({ ios: 'xmark.octagon', android: 'cancel' } as const)
            : issue.severity === 'warning'
              ? ({ ios: 'exclamationmark.triangle', android: 'warning' } as const)
              : ({ ios: 'info.circle', android: 'info' } as const);
        const stepId = issue.stepId;
        return (
          <View
            key={`${issue.code}-${issue.stepId ?? issue.linkId ?? index}`}
            style={[
              styles.issue,
              (index > 0 || shown.length === 0) && {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <SymbolView name={icon} size={22} tintColor={color} />
            <View style={styles.issueText} accessible>
              <ThemedText type="link" style={{ color: theme.text }}>
                {title}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{detail}</ThemedText>
            </View>
            {stepId && (
              <Pressable
                onPress={() => onShow(stepId)}
                accessibilityRole="button"
                accessibilityLabel={`Voir l’étape : ${title}`}
                hitSlop={8}
                style={styles.see}>
                <ThemedText type="link">Voir</ThemedText>
              </Pressable>
            )}
          </View>
        );
      })}
      {folded.length > 0 && (
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={[styles.fold, { borderTopColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.issueText}>
            {open
              ? 'Replier les informations'
              : `${plural(folded.length, 'information repliée', 'informations repliées')}`}
          </ThemedText>
          <SymbolView
            name={
              open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }
            }
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 48,
    borderRadius: Radius.small,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleBlock: { gap: Spacing.one },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three - Spacing.one },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three - Spacing.one, paddingVertical: Spacing.one },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  issue: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three - Spacing.one, padding: Spacing.three },
  issueText: { flex: 1, gap: Spacing.half },
  see: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  step: { flexDirection: 'row', gap: Spacing.three - Spacing.one, padding: Spacing.three },
  stepNumber: { width: 20, paddingTop: Spacing.half },
  stepText: { flex: 1, gap: Spacing.half },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
