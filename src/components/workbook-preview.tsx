import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  SHEET_KIND_LABELS,
  WORKBOOK_KIND_LABELS,
  type FormTemplate,
  type SheetKind,
  type SheetReport,
  type WorkbookReport,
} from '@/import/tableau';
import { plural } from '@/utils/format';

/** Onglets dont on peut choisir les colonnes à la main. */
const CHOOSABLE = new Set<SheetKind>(['inconnu', 'liste']);

const TONES: Record<SheetKind, BadgeTone> = {
  process: 'success',
  'sla-ola': 'success',
  formulaire: 'success',
  liste: 'neutral',
  vide: 'neutral',
  inconnu: 'warning',
};

/** « 4 situations · 13 colonnes · 1 fusion » : ce qui a été trouvé dans un onglet. */
export function sheetMeta(sheet: SheetReport): string {
  const unit = sheet.kind === 'sla-ola' ? 'situation' : sheet.kind === 'process' ? 'étape' : 'ligne';
  return [
    plural(sheet.rowCount, unit),
    plural(sheet.columnCount, 'colonne'),
    sheet.mergedCount > 0 && plural(sheet.mergedCount, 'fusion'),
    sheet.hidden && 'masqué',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Ce que l'app a reconnu dans un classeur Excel ou un CSV : le genre de
 * fichier, puis chaque onglet avec ce qu'il contient.
 */
export function WorkbookPreview({
  report,
  warnings,
  importable,
  onChooseColumns,
  form,
  onShowForm,
  linkedSituations = 0,
}: {
  report: WorkbookReport;
  warnings: string[];
  /** Nombre de process importables (onglets « process »). */
  importable: number;
  /** Onglet non reconnu : ouvrir le choix des colonnes (index de l'onglet). */
  onChooseColumns?: (index: number) => void;
  /** Le formulaire lu dans un template, à ouvrir avec `onShowForm`. */
  form?: FormTemplate | null;
  onShowForm?: () => void;
  /** Situations du même classeur, liées d'office au formulaire. */
  linkedSituations?: number;
}) {
  const theme = useTheme();
  const later = report.sheets.some((sheet) => sheet.kind === 'formulaire');
  const situations = report.sheets.some((sheet) => sheet.kind === 'sla-ola');
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Ce que l’app a lu
      </ThemedText>
      {form && onShowForm && (
        <Pressable
          onPress={onShowForm}
          accessibilityRole="button"
          accessibilityLabel={`Voir le formulaire ${form.name ?? ''}, ${plural(form.questions.length, 'question')}`}
          style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
          <View style={[styles.formIcon, { backgroundColor: theme.primaryBackground }]}>
            <SymbolView name={{ ios: 'list.bullet.rectangle', android: 'dynamic_form' }} size={24} tintColor={theme.link} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={styles.title}>
              {linkedSituations > 0 ? 'Remplir le formulaire, puis suivre son process' : 'Voir le formulaire'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                form.name,
                plural(form.questions.length, 'question'),
                linkedSituations > 0 ? `lié à ${plural(linkedSituations, 'situation')}` : 'formulaire seul',
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </View>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} tintColor={theme.textSecondary} />
        </Pressable>
      )}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.summary}>
          <ThemedText type="smallBold" style={styles.title}>
            {WORKBOOK_KIND_LABELS[report.kind]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plural(report.sheets.length, 'onglet')}
          </ThemedText>
        </View>
        {report.sheets.map((sheet, index) => (
          <View key={sheet.name} style={[styles.sheet, { borderTopColor: theme.border }]}>
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`Onglet ${sheet.name}. ${SHEET_KIND_LABELS[sheet.kind]}. ${sheetMeta(sheet)}`}>
              <View style={styles.flex}>
                <ThemedText>{sheet.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {sheetMeta(sheet)}
                </ThemedText>
              </View>
              <Badge label={SHEET_KIND_LABELS[sheet.kind]} tone={TONES[sheet.kind]} />
            </View>
            {onChooseColumns && CHOOSABLE.has(sheet.kind) && (
              <Pressable
                onPress={() => onChooseColumns(index)}
                accessibilityRole="button"
                accessibilityLabel={`Choisir les colonnes de l’onglet ${sheet.name}`}
                style={styles.choose}>
                <ThemedText type="link" style={{ color: theme.link }}>
                  Choisir les colonnes
                </ThemedText>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {warnings.length > 0 && (
        <View style={[styles.notice, { backgroundColor: theme.warningBackground }]}>
          <SymbolView name={{ ios: 'exclamationmark.triangle', android: 'warning' }} size={20} tintColor={theme.warning} />
          <View style={styles.flex}>
            {warnings.map((warning) => (
              <ThemedText key={warning} type="small" style={{ color: theme.warning }}>
                {warning}
              </ThemedText>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.notice, { backgroundColor: theme.primaryBackground }]}>
        <SymbolView name={{ ios: 'info.circle', android: 'info' }} size={20} tintColor={theme.link} />
        <ThemedText type="small" style={styles.flex}>
          {form ? formNotice(importable, linkedSituations > 0) : importNotice(importable, later, situations)}
        </ThemedText>
      </View>
    </View>
  );
}

/** Template de formulaire, seul ou avec son workflow dans le même classeur. */
export function formNotice(importable: number, linked = false): string {
  const local = 'Le fichier est lu sur l’appareil, sans être envoyé ni gardé.';
  if (linked) {
    return `${local} Le formulaire et son workflow sont dans ce classeur : touchez la carte du formulaire, remplissez-le, et la situation choisie mène à son process. Chaque situation s’importe aussi seule, plus bas.`;
  }
  const next = 'Touchez « Voir le formulaire » pour le remplir comme le demandeur.';
  return `${local} ${next}${importable > 0 ? '' : ' Formulaire seul : la simulation s’arrête à l’envoi, sauf si vous lui liez un workflow.'}`;
}

/** Ce qui s'importe, et ce qui viendra plus tard. `situations` : le classeur a des onglets « SLA / OLA ». */
export function importNotice(importable: number, later: boolean, situations = false): string {
  const local = 'Le fichier est lu sur l’appareil, sans être envoyé ni gardé.';
  if (situations && importable > 0) {
    return `${local} Chaque situation du workflow devient un process prêt à simuler : choisissez-la plus bas, avec son rapport de lecture.`;
  }
  if (importable > 0) {
    return later ? `${local} Seuls les onglets « Process » s’importent pour l’instant.` : local;
  }
  if (situations) return `${local} Aucune situation n’est encore décrite (ni SLA ni étape) : rien à importer.`;
  if (later) return `${local} L’import des formulaires arrive dans une prochaine version.`;
  return `${local} Aucun onglet ne ressemble à un tableau de process (colonnes Étape, Acteur, Délai…) : touchez « Choisir les colonnes » sous un onglet pour dire à l’app où elles sont.`;
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  summary: { gap: Spacing.half, padding: Spacing.three },
  title: { fontSize: 16 },
  sheet: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  choose: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, marginTop: -Spacing.two },
  flex: { flex: 1 },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  formIcon: { width: 44, height: 44, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.medium },
});
