import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { situationLevel, VARIANT_LABELS, type Situation, type WarningLevel } from '@/import/tableau';
import { plural } from '@/utils/format';

const LEVELS: Record<WarningLevel | 'ok', { label: string; tone: BadgeTone }> = {
  rouge: { label: 'À corriger', tone: 'danger' },
  orange: { label: 'À vérifier', tone: 'warning' },
  info: { label: 'Lue, avec une info', tone: 'success' },
  ok: { label: 'Lue sans ambiguïté', tone: 'success' },
};

const days = (value: number) => `${String(value).replace('.', ',')} JO`;

/** « SLA 6 JO · Groupe A (3 JO) → Groupe B (3 JO) » : le résumé d'une situation, comme une ligne du récapitulatif. */
export function situationMeta(situation: Situation): string {
  const steps = situation.steps
    .map((step) => `${step.group ?? 'groupe ?'}${step.olaDays !== null ? ` (${days(step.olaDays)})` : ''}`)
    .join(' → ');
  return [situation.slaDays !== null ? `SLA ${days(situation.slaDays)}` : 'SLA ?', steps || 'aucune étape'].join(' · ');
}

/**
 * Les situations d'un workflow avec SLA et OLA, regroupées par famille : le
 * rapport de lecture (une pastille par situation) et le choix de celle à
 * importer. Sous la situation choisie, ses avertissements, avec la cellule
 * d'origine et la question à poser au métier.
 */
export function SituationList({
  situations,
  selected,
  onSelect,
  skipped,
}: {
  situations: Situation[];
  /** Index de la situation choisie, ou -1. */
  selected: number;
  onSelect: (index: number) => void;
  /** Lignes qui nomment une situation sans encore la décrire. */
  skipped: number;
}) {
  const theme = useTheme();
  const levels = situations.map((situation) => situationLevel(situation.warnings));
  const red = levels.filter((level) => level === 'rouge').length;
  const orange = levels.filter((level) => level === 'orange').length;
  const families = [...new Set(situations.map((situation) => situation.family))];

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Situation à importer
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {[
          `${plural(situations.length, 'situation')} : chacune devient un process`,
          red > 0 && `${red} à corriger`,
          orange > 0 && `${orange} à vérifier`,
        ]
          .filter(Boolean)
          .join(' · ')}
        .{skipped > 0 && ` ${plural(skipped, 'ligne')} sans SLA ni étape, pas encore ${skipped > 1 ? 'décrites' : 'décrite'}, ${skipped > 1 ? 'sont ignorées' : 'est ignorée'}.`}
      </ThemedText>

      {families.map((family) => (
        <View key={family} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.family, { backgroundColor: theme.surfaceMuted }]}>
            <ThemedText type="smallBold" accessibilityRole="header">
              {family}
            </ThemedText>
          </View>
          <View accessibilityRole="radiogroup">
            {situations.map((situation, index) => {
              if (situation.family !== family) return null;
              const on = index === selected;
              const level = LEVELS[levels[index] ?? 'ok'];
              return (
                <View key={`${situation.sheet}-${situation.row}`} style={[styles.item, { borderTopColor: theme.border }]}>
                  <Pressable
                    onPress={() => onSelect(index)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${situation.label}, ${situationMeta(situation)}, ${level.label}`}
                    style={[styles.row, on && { backgroundColor: theme.primaryBackground }]}>
                    <SymbolView
                      name={
                        on
                          ? { ios: 'largecircle.fill.circle', android: 'radio_button_checked' }
                          : { ios: 'circle', android: 'radio_button_unchecked' }
                      }
                      size={22}
                      tintColor={on ? theme.primary : theme.textSecondary}
                    />
                    <View style={styles.text}>
                      <ThemedText>{situation.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {situationMeta(situation)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {VARIANT_LABELS[situation.variant]}
                      </ThemedText>
                      <View style={styles.badge}>
                        <Badge label={level.label} tone={level.tone} />
                      </View>
                    </View>
                  </Pressable>
                  {on && situation.warnings.length > 0 && (
                    <View style={styles.warnings}>
                      {situation.warnings.map((warning, position) => (
                        <View
                          key={`${warning.cell}-${position}`}
                          style={[styles.warning, { borderLeftColor: warning.level === 'rouge' ? theme.danger : warning.level === 'orange' ? theme.warning : theme.border }]}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {situation.sheet}
                            {warning.cell ? ` · ${warning.cell}` : ` · ligne ${situation.row}`}
                          </ThemedText>
                          <ThemedText type="small">{warning.message}</ThemedText>
                          {warning.question && (
                            <ThemedText type="small" themeColor="textSecondary" style={styles.italic}>
                              Question à poser : {warning.question}
                            </ThemedText>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  family: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  item: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 64, padding: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  warnings: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  warning: { gap: Spacing.half, borderLeftWidth: 3, paddingLeft: Spacing.two },
  italic: { fontStyle: 'italic' },
  badge: { flexDirection: 'row', marginTop: Spacing.one },
});
