import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getT, useT, type Messages } from '@/i18n';
import { type FormTemplate, type SheetKind, type SheetReport, type WorkbookReport } from '@/import/tableau';

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
export function sheetMeta(sheet: SheetReport, t: Messages = getT()): string {
  const unit = sheet.kind === 'sla-ola' ? t.words.situation : sheet.kind === 'process' ? t.words.step : t.words.row;
  const { count } = t.format;
  return [
    count(sheet.rowCount, unit),
    count(sheet.columnCount, t.workbook.column),
    sheet.mergedCount > 0 && count(sheet.mergedCount, t.workbook.merge),
    sheet.hidden && t.workbook.hidden,
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
  const t = useT();
  const b = t.workbook;
  const { count } = t.format;
  const partialForm = report.sheets.some((sheet) => sheet.kind === 'formulaire');
  const situations = report.sheets.some((sheet) => sheet.kind === 'sla-ola');
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {b.read}
      </ThemedText>
      {form && onShowForm && (
        <Pressable
          onPress={onShowForm}
          accessibilityRole="button"
          accessibilityLabel={b.showFormLabel(form.name ?? '', count(form.questions.length, t.words.question))}
          style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
          <View style={[styles.formIcon, { backgroundColor: theme.primaryBackground }]}>
            <SymbolView
              name={{ ios: 'list.bullet.rectangle', android: 'dynamic_form' }}
              size={24}
              tintColor={theme.link}
            />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={styles.title}>
              {linkedSituations > 0 ? b.fillThenFollow : b.showForm}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                form.name,
                count(form.questions.length, t.words.question),
                linkedSituations > 0 ? b.linkedTo(count(linkedSituations, t.words.situation)) : b.formOnly,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right' }}
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.summary}>
          <ThemedText type="smallBold" style={styles.title}>
            {b.kinds[report.kind]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {count(report.sheets.length, t.words.sheet)}
          </ThemedText>
        </View>
        {report.sheets.map((sheet, index) => (
          <View key={sheet.name} style={[styles.sheet, { borderTopColor: theme.border }]}>
            <View
              style={styles.row}
              accessible
              accessibilityLabel={b.sheetLabel(sheet.name, b.sheetKinds[sheet.kind], sheetMeta(sheet, t))}>
              <View style={styles.flex}>
                <ThemedText>{sheet.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {sheetMeta(sheet, t)}
                </ThemedText>
              </View>
              <Badge label={b.sheetKinds[sheet.kind]} tone={TONES[sheet.kind]} />
            </View>
            {onChooseColumns && CHOOSABLE.has(sheet.kind) && (
              <Pressable
                onPress={() => onChooseColumns(index)}
                accessibilityRole="button"
                accessibilityLabel={b.chooseColumnsOf(sheet.name)}
                style={styles.choose}>
                <ThemedText type="link" style={{ color: theme.link }}>
                  {b.chooseColumns}
                </ThemedText>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {warnings.length > 0 && (
        <View style={[styles.notice, { backgroundColor: theme.warningBackground }]}>
          <SymbolView
            name={{ ios: 'exclamationmark.triangle', android: 'warning' }}
            size={20}
            tintColor={theme.warning}
          />
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
          {form
            ? formNotice(t, importable, linkedSituations > 0)
            : importNotice(t, importable, partialForm, situations)}
        </ThemedText>
      </View>
    </View>
  );
}

/** Template de formulaire, seul ou avec son workflow dans le même classeur. */
export function formNotice(t: Messages, importable: number, linked = false): string {
  const b = t.workbook;
  if (linked) return `${b.local} ${b.formLinked}`;
  return `${b.local} ${b.formNext}${importable > 0 ? '' : b.formAlone}`;
}

/**
 * Ce qui s'importe. `partialForm` : le classeur a des onglets de template de formulaire,
 * mais aucun formulaire n'a pu y être lu (pas d'onglet « Questions »).
 * `situations` : le classeur a des onglets « SLA / OLA ».
 */
export function importNotice(t: Messages, importable: number, partialForm: boolean, situations = false): string {
  const b = t.workbook;
  const { local } = b;
  if (situations && importable > 0) return `${local} ${b.situations}`;
  if (importable > 0) return partialForm ? `${local} ${b.partialForm}` : local;
  if (situations) return `${local} ${b.noSituation}`;
  if (partialForm) return `${local} ${b.formNoQuestions}`;
  return `${local} ${b.nothing}`;
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
