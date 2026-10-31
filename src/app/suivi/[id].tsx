import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/badge';
import { PrimaryButton } from '@/components/primary-button';
import { StateMessage } from '@/components/state-message';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess, useImportedProcesses } from '@/data/process-store';
import { getTracking, removeTracking, saveTracking, useTrackings } from '@/data/tracking-store';
import type { Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { workingDaysBetween } from '@/tracking/calendar';
import { formatMoment, timingBadge } from '@/tracking/format';
import { completeStep, currentStep, nextChoices, stepOf, type Tracking } from '@/tracking/tracking';
import { plural } from '@/utils/format';

/**
 * Suivi d'une demande réelle : l'étape en cours avec son échéance (jours
 * ouvrés), le bouton pour la terminer (ou choisir la branche à une décision),
 * puis l'historique des étapes passées.
 */
export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useTrackings(); // relit le suivi après chaque étape
  useImportedProcesses();
  const tracking = getTracking(id);
  const process = tracking && getProcess(tracking.processId);
  const theme = useTheme();

  if (!tracking || !process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title="Suivi introuvable"
          message="Cette demande ou son process n’existe plus sur ce téléphone."
          action={{ label: 'Revenir', onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <TrackingDetail tracking={tracking} process={process} />;
}

/** L'heure actuelle, relue chaque minute pour que les échéances restent justes. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function TrackingDetail({ tracking, process }: { tracking: Tracking; process: Process }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const current = currentStep(tracking);
  const choices = nextChoices(process, tracking);
  const done = tracking.steps.filter((step) => step.doneAt).reverse();
  const titleOf = (stepId: string) => process.steps.find((step) => step.id === stepId)?.title || 'Sans titre';

  const complete = (linkId?: string) => saveTracking(completeStep(process, tracking, new Date(), linkId));

  const confirmStop = () =>
    Alert.alert('Arrêter ce suivi ?', `« ${tracking.label} » sera retiré de ce téléphone.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: () => {
          removeTracking(tracking.id);
          router.back();
        },
      },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerBackTitle: 'Process',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.titleBlock}>
          <ThemedText type="title" accessibilityRole="header">
            {tracking.label}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {process.name} · commencée le {formatMoment(tracking.startedAt)}
          </ThemedText>
        </View>

        {current ? (
          <View style={[styles.card, styles.current, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Étape en cours
            </ThemedText>
            <ThemedText type="subtitle">{titleOf(current.stepId)}</ThemedText>
            {stepOf(process, current)?.actor && (
              <ThemedText themeColor="textSecondary">{stepOf(process, current)?.actor}</ThemedText>
            )}
            <View style={styles.dueRow} accessible>
              <ThemedText>
                {current.dueAt ? `Échéance : ${formatMoment(current.dueAt)}` : 'Pas de délai pour cette étape'}
              </ThemedText>
              {current.dueAt && <Badge {...timingBadge(current, now)} />}
            </View>
            {choices.length > 1 ? (
              <View style={styles.choices}>
                <ThemedText type="smallBold">Étape terminée : quelle suite ?</ThemedText>
                {choices.map((link) => (
                  <PrimaryButton
                    key={link.id}
                    label={`${link.label ?? 'Suite'} → ${titleOf(link.to)}`}
                    onPress={() => complete(link.id)}
                  />
                ))}
              </View>
            ) : (
              <PrimaryButton
                label={choices.length === 1 ? 'Étape terminée' : 'Terminer la demande'}
                accessibilityLabel={
                  choices.length === 1 ? `Étape terminée, passer à « ${titleOf(choices[0].to)} »` : undefined
                }
                onPress={() => complete()}
              />
            )}
          </View>
        ) : (
          <View
            style={[
              styles.card,
              styles.current,
              { backgroundColor: theme.successBackground, borderColor: theme.border },
            ]}>
            <ThemedText type="subtitle" style={{ color: theme.success }}>
              Demande terminée
            </ThemedText>
            <ThemedText style={{ color: theme.success }}>
              Le {formatMoment(tracking.finishedAt!)}, en{' '}
              {plural(
                Math.max(0, workingDaysBetween(new Date(tracking.startedAt), new Date(tracking.finishedAt!))),
                'jour ouvré',
                'jours ouvrés',
              )}
              .
            </ThemedText>
          </View>
        )}

        {done.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              Étapes passées
            </ThemedText>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {done.map((step, index) => (
                <View
                  key={`${step.stepId}-${step.startedAt}`}
                  accessible
                  style={[
                    styles.row,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <ThemedText>{titleOf(step.stepId)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Terminée le {formatMoment(step.doneAt!)}
                  </ThemedText>
                  <Badge {...timingBadge(step, now)} />
                </View>
              ))}
            </View>
          </View>
        )}

        <Pressable onPress={confirmStop} accessibilityRole="button" style={styles.stop}>
          <ThemedText type="link" style={{ color: theme.danger }}>
            Arrêter ce suivi
          </ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.four, padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  titleBlock: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  current: { gap: Spacing.two, padding: Spacing.three },
  dueRow: { alignItems: 'flex-start', gap: Spacing.one, marginBottom: Spacing.one },
  choices: { gap: Spacing.two },
  section: { gap: Spacing.two },
  row: { alignItems: 'flex-start', gap: Spacing.one, padding: Spacing.three },
  flex: { flex: 1 },
  stop: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
