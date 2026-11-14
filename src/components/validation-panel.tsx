import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { ThemedText } from '@/components/themed-text';
import { validationSummary } from '@/components/validation-card';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useValidationData } from '@/data/validation-data';
import { validationOverview, type MemberProgress, type Process } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const STATE_TONES: Record<MemberProgress['state'], BadgeTone> = {
  termine: 'success',
  en_cours: 'neutral',
  pas_commence: 'neutral',
};

/**
 * « Suivi de la validation » d'un process partagé, pour son propriétaire : où
 * en est chaque membre, puis, étape par étape, qui l'a validée et ce qui est à
 * revoir. « Process entièrement validé » quand tout le monde a fini sans rien
 * à revoir.
 */
export function ValidationPanel({ process, cloudId }: { process: Process; cloudId: string }) {
  const theme = useTheme();
  const t = useT();
  const v = t.validationPanel;
  const data = useValidationData(cloudId);
  const [onlyToRevise, setOnlyToRevise] = useState(false);
  const overview = useMemo(
    () => (data.status === 'ready' ? validationOverview(process, data.members, data.reviews) : null),
    [data, process],
  );
  const numbers = useMemo(() => new Map(process.steps.map((step, index) => [step.id, index + 1])), [process]);
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  if (data.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }
  if (data.status === 'error' || !overview) {
    return (
      <View style={styles.content}>
        <View style={card}>
          <ThemedText style={[styles.row, { color: theme.danger }]}>
            {data.status === 'error' ? data.message : ''}
          </ThemedText>
          <Pressable onPress={data.reload} accessibilityRole="button" style={styles.row}>
            <ThemedText type="link">{t.common.retry}</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }
  if (overview.members.length === 0) {
    return (
      <View style={styles.content}>
        <ThemedText type="subtitle">{process.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{v.nobody}</ThemedText>
      </View>
    );
  }

  const steps = onlyToRevise ? overview.steps.filter((item) => item.toRevise.length > 0) : overview.steps;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ThemedText type="subtitle">{process.name}</ThemedText>

      <View
        style={[
          styles.banner,
          {
            backgroundColor: overview.fullyValidated
              ? theme.successBackground
              : overview.toReviseCount > 0
                ? theme.warningBackground
                : theme.primaryBackground,
          },
        ]}
        accessibilityLiveRegion="polite">
        <ThemedText
          type="smallBold"
          style={{
            color: overview.fullyValidated ? theme.success : overview.toReviseCount > 0 ? theme.warning : theme.text,
          }}>
          {overview.fullyValidated ? '✓ ' : ''}
          {validationSummary(t, overview)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {overview.fullyValidated ? v.allDone : overview.toReviseCount > 0 ? v.fixHint : v.waiting}
        </ThemedText>
        <Pressable onPress={data.reload} accessibilityRole="button" hitSlop={8} style={styles.link}>
          <ThemedText type="smallBold" style={{ color: theme.link }}>
            {v.refresh}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
          {v.members(overview.members.length)}
        </ThemedText>
        <View style={card}>
          {overview.members.map((item, index) => (
            <View
              key={item.member.id}
              accessible
              style={[
                styles.member,
                index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={styles.flex}>
                <ThemedText>{item.member.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    item.member.actor ?? v.wholeProcess,
                    v.validated(item.validated, item.total),
                    item.toRevise ? v.toReviseCount(item.toRevise) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              <Badge
                {...(item.state === 'termine' && item.toRevise > 0
                  ? { label: v.toRevise, tone: 'warning' as const }
                  : { label: v.states[item.state], tone: STATE_TONES[item.state] })}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
          {v.steps}
        </ThemedText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {[false, true].map((option) => {
            const selected = option === onlyToRevise;
            return (
              <Pressable
                key={String(option)}
                onPress={() => setOnlyToRevise(option)}
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
                  {option ? v.filterToRevise(overview.toReviseCount) : v.filterAll(overview.steps.length)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {steps.length === 0 && <ThemedText themeColor="textSecondary">{v.noneToRevise}</ThemedText>}
        {steps.map(({ step, validatedBy, toRevise }) => (
          <View
            key={step.id}
            style={[...card, styles.step, toRevise.length > 0 && { borderColor: theme.warning, borderWidth: 1 }]}>
            <View style={styles.stepHead}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
                {numbers.get(step.id)}
              </ThemedText>
              <View style={styles.flex}>
                <ThemedText>{step.title || t.untitled}</ThemedText>
                {step.actor ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {step.actor}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            {toRevise.map(({ member, comment }) => (
              <View key={member.id} style={[styles.remark, { backgroundColor: theme.warningBackground }]}>
                <ThemedText type="smallBold" style={{ color: theme.warning }}>
                  {v.toReviseBy(member.name)}
                </ThemedText>
                <ThemedText type="small">{v.quote(comment)}</ThemedText>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              {validatedBy.length
                ? v.validatedBy(validatedBy.map((member) => member.name).join(', '))
                : toRevise.length
                  ? v.validatedByNobody
                  : v.noReview}
            </ThemedText>
          </View>
        ))}
        {overview.steps.length > 0 && !onlyToRevise && (
          <ThemedText type="small" themeColor="textSecondary">
            {v.toRead(t.format.count(overview.steps.length, t.words.step))}
          </ThemedText>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.half },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  banner: { padding: Spacing.three, borderRadius: Radius.medium, gap: Spacing.one },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  field: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three },
  row: { minHeight: 48, paddingVertical: Spacing.three },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  step: { gap: Spacing.two, paddingVertical: Spacing.three },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  number: { minWidth: 22, paddingTop: 2 },
  remark: { padding: Spacing.two, borderRadius: Radius.small, gap: Spacing.half },
});
