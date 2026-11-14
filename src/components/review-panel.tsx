import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { listMyReviews, removeReview, saveReview, type SharedProcess } from '@/backend/shared';
import { Badge } from '@/components/badge';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  MAX_COMMENT,
  myPartSteps,
  reviewableSteps,
  reviewProblem,
  reviewProgress,
  type ReviewStatus,
  type Step,
  type StepReview,
} from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/utils/format';

const STATUS_LABELS: Record<ReviewStatus, string> = { valide: 'Validée', a_revoir: 'À revoir' };

/**
 * Relecture d'un process partagé par un membre : ses étapes (celles de
 * l'acteur qui lui est confié, ou tout le process), et pour chacune son avis :
 * validée, ou à revoir avec un commentaire. Chaque avis part tout de suite.
 */
export type ReviewApi = {
  load: () => Promise<StepReview[]>;
  save: (review: StepReview) => Promise<void>;
  remove: (stepId: string) => Promise<void>;
};

/** Les avis du compte connecté sur un process partagé avec lui. */
const cloudReviews = (cloudId: string): ReviewApi => ({
  load: () => listMyReviews(cloudId),
  save: (review) => saveReview(cloudId, review),
  remove: (stepId) => removeReview(cloudId, stepId),
});

export function ReviewPanel({
  shared,
  api: given,
  note,
}: {
  shared: Pick<SharedProcess, 'process' | 'actor' | 'ownerName'> & { cloudId?: string };
  /** Où lire et écrire les avis ; par défaut, ceux du compte connecté (`shared.cloudId`). */
  api?: ReviewApi;
  /** Remplace la phrase « … voit vos avis ». */
  note?: string;
}) {
  const theme = useTheme();
  const { process, actor, cloudId } = shared;
  const api = useMemo(() => given ?? cloudReviews(cloudId ?? ''), [given, cloudId]);
  const mine = useMemo(() => myPartSteps(process, actor), [process, actor]);
  const all = useMemo(() => reviewableSteps(process), [process]);
  // Un acteur confié qui n'a plus d'étape (le schéma a changé) : tout est à relire.
  const hasPart = Boolean(actor) && mine.length > 0;
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const steps = hasPart && scope === 'mine' ? mine : all;

  const [reviews, setReviews] = useState<StepReview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const fetchReviews = useCallback(
    () =>
      api
        .load()
        .then(setReviews, (cause: unknown) =>
          setLoadError(cause instanceof Error ? cause.message : 'Vos avis n’ont pas pu être lus.'),
        ),
    [api],
  );

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const reload = () => {
    setLoadError(null);
    setReviews(null);
    fetchReviews();
  };

  const byStep = useMemo(() => new Map((reviews ?? []).map((review) => [review.stepId, review])), [reviews]);
  const progress = reviewProgress(hasPart ? mine : all, reviews ?? []);
  const numbers = useMemo(() => new Map(process.steps.map((step, index) => [step.id, index + 1])), [process]);

  const save = async (review: StepReview) => {
    await api.save(review);
    setReviews((list) => [...(list ?? []).filter((item) => item.stepId !== review.stepId), review]);
    setEditing(null);
  };

  const clear = async (stepId: string) => {
    await api.remove(stepId);
    setReviews((list) => (list ?? []).filter((item) => item.stepId !== stepId));
    setEditing(null);
  };

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <ThemedText type="subtitle">{process.name}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {hasPart
            ? `${shared.ownerName} vous confie « ${actor} » : ${plural(mine.length, 'étape')} à relire.`
            : actor
              ? `« ${actor} » n’a plus d’étape dans ce schéma : relisez tout le process.`
              : `${shared.ownerName} vous confie tout le process : ${plural(all.length, 'étape')} à relire.`}
        </ThemedText>
      </View>

      {reviews && (
        <View
          style={[
            styles.notice,
            { backgroundColor: progress.done ? theme.successBackground : theme.primaryBackground },
          ]}
          accessibilityLiveRegion="polite">
          <ThemedText type="smallBold" style={{ color: progress.done ? theme.success : theme.text }}>
            {progress.done
              ? progress.toRevise
                ? `Merci : votre partie est relue, avec ${plural(progress.toRevise, 'étape')} à revoir.`
                : 'Merci : votre partie est relue et validée.'
              : `${progress.validated} validée${progress.validated > 1 ? 's' : ''} · ${progress.toRevise} à revoir · ${progress.pending} à relire`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {note ?? `${shared.ownerName} voit vos avis. Vous pouvez les changer tant que vous êtes membre.`}
          </ThemedText>
        </View>
      )}

      {hasPart && (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(['mine', 'all'] as const).map((option) => {
            const selected = option === scope;
            return (
              <Pressable
                key={option}
                onPress={() => setScope(option)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.primary : theme.surface,
                    borderColor: selected ? theme.primary : theme.fieldBorder,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                  {option === 'mine' ? `Ma partie · ${mine.length}` : `Tout le process · ${all.length}`}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      {loadError ? (
        <View style={card}>
          <ThemedText style={[styles.row, { color: theme.danger }]}>{loadError}</ThemedText>
          <Pressable onPress={reload} accessibilityRole="button" style={styles.row}>
            <ThemedText type="link">Réessayer</ThemedText>
          </Pressable>
        </View>
      ) : reviews === null ? (
        <View style={[card, styles.row]}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : steps.length === 0 ? (
        <View style={card}>
          <ThemedText themeColor="textSecondary" style={styles.row}>
            Ce process n’a pas d’étape à relire.
          </ThemedText>
        </View>
      ) : (
        steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            number={numbers.get(step.id) ?? 0}
            review={byStep.get(step.id)}
            editing={editing === step.id}
            onEdit={() => setEditing(step.id)}
            onCancel={() => setEditing(null)}
            onSave={save}
            onClear={clear}
          />
        ))
      )}
    </ScrollView>
  );
}

/** Une étape à relire, avec mon avis. */
function StepCard({
  step,
  number,
  review,
  editing,
  onEdit,
  onCancel,
  onSave,
  onClear,
}: {
  step: Step;
  number: number;
  review: StepReview | undefined;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (review: StepReview) => Promise<void>;
  onClear: (stepId: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [status, setStatus] = useState<ReviewStatus>(review?.status ?? 'a_revoir');
  const [comment, setComment] = useState(review?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Votre avis n’a pas pu être enregistré.');
    } finally {
      setBusy(false);
    }
  };

  const open = (next: ReviewStatus) => {
    setStatus(next);
    setComment(review?.comment ?? '');
    setError(null);
    onEdit();
  };

  const submit = () => {
    const problem = reviewProblem(status, comment);
    if (problem) return setError(problem);
    run(() => onSave({ stepId: step.id, status, comment: comment.trim() || null }));
  };

  const meta = [step.actor, step.duration ? plural(step.duration, 'jour ouvré', 'jours ouvrés') : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[
        styles.card,
        styles.step,
        {
          backgroundColor: theme.surface,
          borderColor: review?.status === 'a_revoir' ? theme.warning : theme.border,
        },
      ]}>
      <View style={styles.stepHead}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
          {number}
        </ThemedText>
        <View style={styles.flex}>
          <ThemedText>{step.title || 'Sans titre'}</ThemedText>
          {meta ? (
            <ThemedText type="small" themeColor="textSecondary">
              {meta}
            </ThemedText>
          ) : null}
        </View>
        {review && (
          <Badge label={STATUS_LABELS[review.status]} tone={review.status === 'valide' ? 'success' : 'warning'} />
        )}
      </View>

      {review?.comment && !editing && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.comment}>
          « {review.comment} »
        </ThemedText>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      {editing ? (
        <View style={styles.field}>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(['valide', 'a_revoir'] as const).map((option) => {
              const selected = option === status;
              return (
                <Pressable
                  key={option}
                  onPress={() => setStatus(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderColor: selected ? theme.primary : theme.fieldBorder,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {STATUS_LABELS[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={comment}
            onChangeText={(text) => {
              setComment(text);
              setError(null);
            }}
            multiline
            maxLength={MAX_COMMENT}
            textAlignVertical="top"
            placeholder={
              status === 'a_revoir'
                ? 'Ce qui est à revoir : délai, acteur, étape manquante…'
                : 'Commentaire (facultatif)'
            }
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={`Commentaire sur l’étape ${number}`}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.fieldBorder },
            ]}
          />
          <PrimaryButton label={busy ? 'Envoi…' : 'Enregistrer mon avis'} onPress={submit} disabled={busy} />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8} style={styles.link}>
              <ThemedText type="smallBold" style={{ color: theme.link }}>
                Annuler
              </ThemedText>
            </Pressable>
            {review && (
              <Pressable
                onPress={() => run(() => onClear(step.id))}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.link}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  Retirer mon avis
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      ) : review ? (
        <Pressable
          onPress={() => open(review.status)}
          accessibilityRole="button"
          accessibilityLabel={`Changer mon avis sur l’étape ${number}`}
          hitSlop={8}
          style={styles.link}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            Changer mon avis
          </ThemedText>
        </Pressable>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={() => run(() => onSave({ stepId: step.id, status: 'valide', comment: null }))}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Valider l’étape ${number}`}
            style={[styles.choice, { backgroundColor: theme.successBackground }]}>
            <ThemedText type="smallBold" style={{ color: theme.success }}>
              ✓ Valider
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => open('a_revoir')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Signaler l’étape ${number} à revoir`}
            style={[styles.choice, { backgroundColor: theme.warningBackground }]}>
            <ThemedText type="smallBold" style={{ color: theme.warning }}>
              À revoir…
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.half },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: { gap: Spacing.two },
  notice: { padding: Spacing.three, borderRadius: Radius.medium, gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three },
  row: { minHeight: 48, paddingVertical: Spacing.three },
  step: { gap: Spacing.two, paddingVertical: Spacing.three },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  number: { minWidth: 22, paddingTop: 2 },
  comment: { fontStyle: 'italic' },
  input: {
    minHeight: 88,
    borderRadius: Radius.small,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  link: { minHeight: 44, justifyContent: 'center' },
});
