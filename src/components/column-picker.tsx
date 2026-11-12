import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { firstFilledRow, sheetGrid, type ColumnChoice, type Sheet } from '@/import/tableau';
import { headerKind, type ColumnKind } from '@/scan/table';
import { plural } from '@/utils/format';

/** Les rôles proposés pour une colonne, dans l'ordre des pastilles. */
const OPTIONS: { kind: ColumnKind | null; label: string }[] = [
  { kind: null, label: 'Ignorer' },
  { kind: 'step', label: 'Étape' },
  { kind: 'actor', label: 'Acteur' },
  { kind: 'delay', label: 'Délai' },
  { kind: 'next', label: 'Suite' },
  { kind: 'number', label: 'N°' },
];

/** Au-delà, les colonnes ne sont pas proposées (un tableau de process en a rarement autant). */
const MAX_COLUMNS = 30;

/** Choix proposé au départ : ce que l'app reconnaît déjà dans les titres. */
const guess = (header: string[]): ColumnChoice => {
  const seen = new Set<ColumnKind>();
  return header.map((label) => {
    const kind = headerKind(label);
    if (!kind || seen.has(kind)) return null;
    seen.add(kind);
    return kind;
  });
};

/**
 * Tableau non reconnu : l'utilisateur choisit la ligne des titres, puis le
 * rôle de chaque colonne (étape, acteur, délai, suite, numéro, ou ignorer).
 * Chaque rôle ne va qu'à une colonne. `onDone` reçoit la ligne des titres et
 * le choix ; l'écran en tire le process et retient les titres choisis.
 */
export function ColumnPicker({
  sheet,
  onDone,
  onCancel,
}: {
  sheet: Sheet;
  onDone: (headerIndex: number, choice: ColumnChoice) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const rows = useMemo(() => sheetGrid(sheet), [sheet]);
  const [headerIndex, setHeaderIndex] = useState(() => firstFilledRow(sheet));
  const header = rows[headerIndex] ?? [];
  const [choice, setChoice] = useState<ColumnChoice>(() => guess(header));

  const columns = header
    .map((label, index) => ({ label, index }))
    .filter(({ label }) => label.trim())
    .slice(0, MAX_COLUMNS);

  // Lignes sous les titres, jusqu'à la première ligne vide (comme à la lecture).
  const below = rows.slice(headerIndex + 1);
  const empty = below.findIndex((row) => !row.some(Boolean));
  const rowCount = empty < 0 ? below.length : empty;

  const moveHeader = (delta: number) => {
    const next = Math.min(Math.max(0, headerIndex + delta), Math.max(0, rows.length - 1));
    setHeaderIndex(next);
    setChoice(guess(rows[next] ?? []));
  };

  const choose = (index: number, kind: ColumnKind | null) => {
    setChoice((current) => {
      const next = header.map((_, column) => current[column] ?? null);
      // Un rôle ne va qu'à une colonne : il quitte celle qui l'avait.
      if (kind) {
        for (let column = 0; column < next.length; column++) if (next[column] === kind) next[column] = null;
      }
      next[index] = kind;
      return next;
    });
  };

  const ready = choice.includes('step');

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">
        Choisir les colonnes · {sheet.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Dites à l’app quelle colonne contient l’étape, l’acteur, le délai… Elle s’en souviendra pour les
        prochains tableaux qui ont ces titres.
      </ThemedText>

      <View style={styles.headerRow}>
        <ThemedText style={styles.flex}>Ligne des titres : {headerIndex + 1}</ThemedText>
        <StepButton
          label="Précédente"
          disabled={headerIndex === 0}
          onPress={() => moveHeader(-1)}
          accessibilityLabel="Ligne des titres précédente"
        />
        <StepButton
          label="Suivante"
          disabled={headerIndex >= rows.length - 1}
          onPress={() => moveHeader(1)}
          accessibilityLabel="Ligne des titres suivante"
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {plural(rowCount, 'ligne')} sous les titres
      </ThemedText>

      {columns.map(({ label, index }) => (
        <View key={index} style={[styles.column, { borderTopColor: theme.border }]}>
          <ThemedText numberOfLines={2}>{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {rows[headerIndex + 1]?.[index] ? `ex. ${rows[headerIndex + 1][index]}` : ' '}
          </ThemedText>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={`Rôle de la colonne ${label}`}>
            {OPTIONS.map((option) => {
              const selected = (choice[index] ?? null) === option.kind;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => choose(index, option.kind)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${label} : ${option.label}`}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.primary : theme.surfaceMuted,
                      borderColor: selected ? theme.primary : theme.fieldBorder,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.text }}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <PrimaryButton
        label="Lire ce tableau"
        onPress={() => onDone(headerIndex, header.map((_, column) => choice[column] ?? null))}
        disabled={!ready}
        accessibilityLabel={ready ? 'Lire ce tableau' : 'Lire ce tableau, choisissez d’abord la colonne Étape'}
      />
      {!ready && (
        <ThemedText type="small" themeColor="textSecondary">
          Choisissez au moins la colonne « Étape ».
        </ThemedText>
      )}
      <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
        <ThemedText type="link" style={{ color: theme.link }}>
          Annuler
        </ThemedText>
      </Pressable>
    </View>
  );
}

function StepButton({
  label,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.step, { borderColor: theme.fieldBorder, opacity: disabled ? 0.4 : 1 }]}>
      <ThemedText type="small" style={{ color: theme.link }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  step: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    justifyContent: 'center',
  },
  column: { gap: Spacing.one, paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    minHeight: 36,
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
