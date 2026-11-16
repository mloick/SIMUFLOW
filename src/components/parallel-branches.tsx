import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import type { Simulation, SimulationState } from '@/simulation/engine';

/**
 * Tâches en parallèle, dans la carte d'étape de la Simulation : une ligne par
 * branche en cours (acteur, étape, sorties), dans l'ordre du schéma. On avance
 * les branches dans l'ordre que l'on veut. Sous les branches, chaque jonction
 * dit qui elle attend encore (« Tout est prêt attend : Préparer le colis »).
 *
 * Affiché seulement quand plusieurs branches sont ouvertes : un process
 * séquentiel garde la carte d'étape habituelle.
 */
export function ParallelBranches({
  sim,
  state,
  disabled = false,
  onStep,
}: {
  sim: Simulation;
  state: SimulationState;
  /** Pendant un rejeu (cas simple ou complexe), on ne peut pas choisir. */
  disabled?: boolean;
  onStep: (linkId: string) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const titleOf = (stepId: string) => sim.graph.steps.get(stepId)?.title || t.untitled;
  const active = sim.activeBranches(state);
  const joins = [...new Set(state.waiting.map((branch) => branch.stepId))];
  // Branches arrivées sur une fin pendant que d'autres continuent.
  const done = state.branches.filter((branch) => sim.graph.steps.get(branch.stepId)?.kind === 'end');

  return (
    <View style={styles.list}>
      {active.map(({ branch, step, choices }, index) => (
        <View
          key={`${branch.stepId}-${index}`}
          style={[styles.branch, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
          accessibilityLabel={t.simulation.branchLabel(index + 1, step.title || t.untitled, step.actor ?? '')}>
          <View style={styles.branchHead}>
            <View style={styles.flex}>
              {!!step.actor && (
                <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
                  {step.actor}
                </ThemedText>
              )}
              <ThemedText style={styles.branchTitle} numberOfLines={2}>
                {step.title || t.untitled}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {t.simulation.wd(t.format.num(branch.days))}
            </ThemedText>
          </View>
          {!disabled && (
            <View style={styles.choices}>
              {choices.map((link) => {
                const target = titleOf(link.to);
                const label = choices.length === 1 ? t.simulation.branchNext : link.label || target || t.simulation.exit;
                return (
                  <PressableScale
                    key={link.id}
                    onPress={() => onStep(link.id)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      choices.length === 1 ? t.simulation.nextLabel(target) : t.simulation.choose(link.label || '', target)
                    }
                    style={[styles.choice, { backgroundColor: theme.primaryBackground, borderColor: theme.primary }]}>
                    <ThemedText type="smallBold" style={{ color: theme.link }} numberOfLines={1}>
                      {label}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {t.simulation.to(target)}
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>
      ))}

      {joins.map((joinId) => (
        <View key={joinId} style={styles.note}>
          <SymbolView name={{ ios: 'hourglass', android: 'hourglass_empty' }} size={16} tintColor={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {t.simulation.waitingFor(
              titleOf(joinId),
              sim
                .waitingFor(state, joinId)
                .map((link) => titleOf(link.from))
                .join(', '),
            )}
          </ThemedText>
        </View>
      ))}

      {done.map((branch, index) => (
        <View key={`fin-${branch.stepId}-${index}`} style={styles.note}>
          <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle' }} size={16} tintColor={theme.success} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {t.simulation.branchDone(titleOf(branch.stepId))}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  flex: { flex: 1 },
  branch: {
    gap: Spacing.two,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  branchTitle: { fontSize: 16, lineHeight: 21, fontWeight: 800 },
  branchHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    borderWidth: 1.5,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
