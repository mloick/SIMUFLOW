import { StyleSheet, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/badge';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  SHEET_KIND_LABELS,
  WORKBOOK_KIND_LABELS,
  type SheetKind,
  type SheetReport,
  type WorkbookReport,
} from '@/import/tableau';
import { plural } from '@/utils/format';

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
export function WorkbookPreview({ report, warnings }: { report: WorkbookReport; warnings: string[] }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Ce que l’app a lu
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.summary}>
          <ThemedText type="smallBold" style={styles.title}>
            {WORKBOOK_KIND_LABELS[report.kind]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plural(report.sheets.length, 'onglet')}
          </ThemedText>
        </View>
        {report.sheets.map((sheet) => (
          <View
            key={sheet.name}
            style={[styles.row, { borderTopColor: theme.border }]}
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
          Le fichier est lu sur l’appareil, sans être envoyé ni gardé. La création des process à partir d’un
          tableau arrive dans la prochaine version.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  summary: { gap: Spacing.half, padding: Spacing.three },
  title: { fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.medium },
});
