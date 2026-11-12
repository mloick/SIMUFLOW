import * as DocumentPicker from 'expo-document-picker';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/badge';
import { diagnosticBadge } from '@/components/process-card';
import { PrimaryButton } from '@/components/primary-button';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { ColumnPicker } from '@/components/column-picker';
import { SituationList } from '@/components/situation-list';
import { WorkbookPreview } from '@/components/workbook-preview';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { showForm } from '@/data/form-store';
import { addImportedProcess } from '@/data/process-store';
import { addReadingRules, applyReadingRules, getLearnedHeaders } from '@/data/rules-store';
import { summarize } from '@/domain';
import { ImportError, importProcessFile, learnColumnRules, type ImportResult } from '@/import';
import {
  describeWorkbook,
  readFormTemplate,
  readTableFile,
  sheetGrid,
  sheetToProcessWithColumns,
  situationsToProcesses,
  TABLE_FILE_TYPES,
  workbookToProcesses,
  workbookToSituations,
  type ColumnChoice,
  type FormTemplate,
  type Situation,
  type Workbook,
  type WorkbookReport,
} from '@/import/tableau';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/utils/format';
import { readPickedBytes, readPickedFile } from '@/utils/read-file';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
/** Un classeur peut contenir des images, qui ne sont pas lues : on accepte plus gros. */
const MAX_TABLE_SIZE = 20 * 1024 * 1024;

type FileKind = 'drawio' | 'json' | 'tableau';

/** Préfixe unique des identifiants d'un import. */
const newImportId = () => `import-${Date.now()}`;
/** `applied` : les règles de lecture apprises qui ont corrigé la lecture. */
type Picked = {
  fileName: string;
  result: ImportResult;
  applied: string[];
  /** Index du premier process tiré d'une situation (workflow avec SLA et OLA), s'il y en a. */
  situationsFrom?: number;
};
/** Tableau Excel ou CSV lu : ce que l'app y a reconnu. */
type PickedTable = {
  fileName: string;
  workbook: Workbook;
  report: WorkbookReport;
  warnings: string[];
  /** Le formulaire décrit, quand le classeur est un template de formulaire. */
  form: FormTemplate | null;
  /** Les situations des onglets « SLA / OLA » : chacune devient un process, après ceux des onglets « process ». */
  situations: Situation[];
  /** Lignes de situation pas encore décrites (ni SLA ni étape). */
  skipped: number;
};

/**
 * Modale « Nouveau process » (maquette, écran 5) : choisir un fichier draw.io
 * ou JSON, voir ce qui a été lu, puis l'ajouter à la liste. Un tableau Excel
 * ou CSV est décrit onglet par onglet ; ses onglets « process » s'importent
 * comme les pages d'un draw.io.
 */
export default function ImportScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FileKind | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [table, setTable] = useState<PickedTable | null>(null);
  /** Onglet dont on choisit les colonnes à la main (index), s'il y en a un. */
  const [choosing, setChoosing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [name, setName] = useState('');
  const [nameMissing, setNameMissing] = useState(false);

  const chosen = picked?.result.processes[page];
  const summary = useMemo(() => (chosen ? summarize(chosen) : null), [chosen]);

  const pick = async (nextKind: FileKind) => {
    setKind(nextKind);
    const selection = await DocumentPicker.getDocumentAsync({
      type: nextKind === 'json' ? ['application/json', 'text/plain'] : nextKind === 'tableau' ? TABLE_FILE_TYPES : '*/*',
      copyToCacheDirectory: true,
    });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (nextKind === 'tableau') {
      await pickTable(asset);
      return;
    }
    setTable(null);
    try {
      if (asset.size && asset.size > MAX_FILE_SIZE)
        throw new ImportError('Ce fichier est trop volumineux (5 Mo au plus).');
      const content = await readPickedFile(asset);
      const { result, applied } = applyReadingRules(importProcessFile(asset.name, content, newImportId()));
      setPicked({ fileName: asset.name, result, applied });
      setPage(0);
      setName(result.processes[0].name);
      setNameMissing(false);
      setError(null);
    } catch (cause) {
      setPicked(null);
      setError(cause instanceof ImportError ? cause.message : 'Le fichier n’a pas pu être lu.');
    }
  };

  const pickTable = async (asset: DocumentPicker.DocumentPickerAsset) => {
    setPicked(null);
    setChoosing(null);
    try {
      if (asset.size && asset.size > MAX_TABLE_SIZE)
        throw new ImportError('Ce fichier est trop volumineux (20 Mo au plus).');
      const workbook = readTableFile(asset.name, await readPickedBytes(asset));
      const learned = getLearnedHeaders();
      const report = describeWorkbook(workbook, learned);
      const { situations, skipped } = workbookToSituations(workbook);
      setTable({
        fileName: asset.name,
        workbook,
        report,
        warnings: workbook.warnings,
        form: report.kind === 'formulaire' || report.kind === 'formulaire-workflow' ? readFormTemplate(workbook) : null,
        situations,
        skipped,
      });
      // Les onglets « process » deviennent des process à importer, comme les pages d'un draw.io,
      // puis chaque situation d'un workflow avec SLA et OLA.
      const importId = newImportId();
      const read = workbookToProcesses(workbook, importId, learned);
      const situationsFrom = read.processes.length;
      read.processes.push(...situationsToProcesses(situations, `${importId}-situation`).processes);
      if (read.processes.length > 0) {
        const { result, applied } = applyReadingRules(read);
        setPicked({ fileName: asset.name, result, applied, ...(situations.length > 0 ? { situationsFrom } : {}) });
        setPage(0);
        setName(result.processes[0].name);
        setNameMissing(false);
      }
      setError(null);
    } catch (cause) {
      setTable(null);
      setError(cause instanceof ImportError ? cause.message : 'Le fichier n’a pas pu être lu.');
    }
  };

  /** Colonnes choisies à la main : l'onglet devient un process, et l'app retient les titres. */
  const readWithColumns = (headerIndex: number, choice: ColumnChoice) => {
    if (!table || choosing === null) return;
    const sheet = table.workbook.sheets[choosing];
    const read = sheetToProcessWithColumns(sheet, headerIndex, choice, newImportId());
    if (!read) return;
    addReadingRules(learnColumnRules(sheetGrid(sheet)[headerIndex] ?? [], choice));
    // L'onglet est désormais lu comme un tableau de process.
    const { report } = table;
    setTable({
      ...table,
      report: {
        kind: report.kind === 'inconnu' ? 'process' : report.kind,
        sheets: report.sheets.map((described, index) =>
          index === choosing
            ? { ...described, kind: 'process', rowCount: read.processes[0].steps.length, headerRow: headerIndex + 1 }
            : described,
        ),
      },
    });
    const { result, applied } = applyReadingRules(read);
    setPicked({ fileName: table.fileName, result, applied });
    setPage(0);
    setName(result.processes[0].name);
    setNameMissing(false);
    setChoosing(null);
  };

  const choosePage = (index: number) => {
    setPage(index);
    setName(picked?.result.processes[index].name ?? '');
    setNameMissing(false);
  };

  /** Importe le process ; avec `correct`, ouvre ensuite l'éditeur par-dessus sa fiche. */
  const submit = (correct = false) => {
    if (!chosen) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMissing(true);
      return;
    }
    addImportedProcess({ ...chosen, name: trimmed });
    router.replace({ pathname: '/process/[id]', params: { id: chosen.id } });
    if (correct) router.push({ pathname: '/process/modifier/[id]', params: { id: chosen.id } });
  };

  const pageCount = picked?.result.processes.length ?? 0;
  /** Les situations viennent après les process des onglets « process ». */
  const sheetPageCount = picked?.situationsFrom ?? pageCount;
  const situationCount = pageCount - sheetPageCount;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Nouveau process',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>Annuler</ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <ThemedText type="smallBold" nativeID="nom-label">
            Nom du process
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (text.trim()) setNameMissing(false);
            }}
            placeholder={picked ? undefined : 'Rempli à partir du fichier'}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Nom du process"
            accessibilityHint={nameMissing ? 'Le nom est obligatoire.' : undefined}
            aria-invalid={nameMissing}
            returnKeyType="done"
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surface,
                borderColor: nameMissing ? theme.danger : theme.fieldBorder,
                borderWidth: nameMissing ? 2 : 1,
              },
            ]}
          />
          {nameMissing && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              Le nom est obligatoire.
            </ThemedText>
          )}
        </View>

        <View style={styles.sources}>
          <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
            Source
          </ThemedText>
          <SourceCard
            icon={{ ios: 'doc', android: 'description' }}
            title="Fichier draw.io"
            description="Depuis Fichiers, un mail ou Drive"
            selected={kind === 'drawio'}
            onPress={() => pick('drawio')}
          />
          <SourceCard
            icon={{ ios: 'tablecells', android: 'table_chart' }}
            title="Tableau Excel ou CSV"
            description="Process, workflow avec SLA et OLA, formulaire"
            selected={kind === 'tableau'}
            onPress={() => pick('tableau')}
          />
          <SourceCard
            icon={{ ios: 'viewfinder', android: 'document_scanner' }}
            title="Scanner un tableau"
            description="Photo d’un tableau étape, acteur, délai"
            selected={false}
            onPress={() => router.replace('/scanner')}
          />
          <SourceCard
            icon={{ ios: 'curlybraces', android: 'data_object' }}
            title="Fichier JSON"
            description="Export d’un autre SimuFlow"
            selected={kind === 'json'}
            onPress={() => pick('json')}
          />
        </View>

        {error && (
          <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
            <SymbolView name={{ ios: 'exclamationmark.circle', android: 'error' }} size={20} tintColor={theme.danger} />
            <ThemedText type="small" style={[styles.noticeText, { color: theme.danger }]}>
              {error}
            </ThemedText>
          </View>
        )}

        {table && (
          <WorkbookPreview
            report={table.report}
            warnings={table.warnings}
            importable={pageCount}
            onChooseColumns={setChoosing}
            form={table.form}
            linkedSituations={table.situations.length}
            onShowForm={() => {
              if (!table.form) return;
              // Formulaire et workflow dans le même classeur : ils sont liés d'office.
              showForm(table.form, {
                source: table.fileName,
                workflow: table.situations.length > 0 ? { kind: 'situations', source: table.fileName, situations: table.situations } : null,
              });
              router.push('/formulaire');
            }}
          />
        )}

        {table && choosing !== null && table.workbook.sheets[choosing] && (
          <ColumnPicker
            key={choosing}
            sheet={table.workbook.sheets[choosing]}
            onDone={readWithColumns}
            onCancel={() => setChoosing(null)}
          />
        )}

        {picked && (sheetPageCount > 1 || (sheetPageCount === 1 && situationCount > 0)) && (
          <View style={styles.sources}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              {table ? 'Onglet à importer' : 'Page à importer'}
            </ThemedText>
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              accessibilityRole="radiogroup">
              {picked.result.processes.slice(0, sheetPageCount).map((process, index) => (
                <Pressable
                  key={process.id}
                  onPress={() => choosePage(index)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: index === page }}
                  style={[
                    styles.pageRow,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    index === page && { backgroundColor: theme.primaryBackground },
                  ]}>
                  <SymbolView
                    name={
                      index === page
                        ? { ios: 'largecircle.fill.circle', android: 'radio_button_checked' }
                        : { ios: 'circle', android: 'radio_button_unchecked' }
                    }
                    size={22}
                    tintColor={index === page ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText style={styles.flex}>{process.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {plural(process.steps.length, 'étape')}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {picked && table && situationCount > 0 && (
          <SituationList
            situations={table.situations}
            selected={page - sheetPageCount}
            onSelect={(index) => choosePage(sheetPageCount + index)}
            skipped={table.skipped}
          />
        )}

        {summary && (
          <View style={styles.sources}>
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
              Aperçu
            </ThemedText>
            <View style={[styles.card, styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText>
                {[
                  plural(summary.stepCount, 'étape'),
                  plural(summary.decisionCount, 'décision'),
                  plural(summary.actors.length, 'acteur'),
                ].join(' · ')}
              </ThemedText>
              {summary.actors.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {summary.actors.join(', ')}
                </ThemedText>
              )}
              <View style={styles.badges}>
                <Badge {...diagnosticBadge(summary)} />
              </View>
            </View>
            {picked && picked.applied.length > 0 && (
              <View
                style={[styles.notice, { backgroundColor: theme.primaryBackground }]}
                accessible
                accessibilityLabel={`Corrigé d’après vos corrections précédentes : ${picked.applied.join(', ')}`}>
                <SymbolView
                  name={{ ios: 'wand.and.stars', android: 'auto_fix_high' }}
                  size={20}
                  tintColor={theme.link}
                />
                <View style={styles.noticeText}>
                  <ThemedText type="smallBold" style={{ color: theme.link }}>
                    Corrigé d’après vos corrections précédentes
                  </ThemedText>
                  {picked.applied.map((line) => (
                    <ThemedText key={line} type="small">
                      {line}
                    </ThemedText>
                  ))}
                </View>
              </View>
            )}
            {picked && picked.result.warnings.length > 0 && (
              <View style={[styles.notice, { backgroundColor: theme.warningBackground }]}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle', android: 'warning' }}
                  size={20}
                  tintColor={theme.warning}
                />
                <View style={styles.noticeText}>
                  <ThemedText type="smallBold" style={{ color: theme.warning }}>
                    Lu avec des remarques
                  </ThemedText>
                  {picked.result.warnings.map((warning) => (
                    <ThemedText key={warning} type="small" style={{ color: theme.warning }}>
                      {warning}
                    </ThemedText>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three, borderTopColor: theme.border }]}>
        {picked && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Fichier choisi : {picked.fileName}
            {pageCount > 1
              ? ` · ${situationCount > 0 ? plural(pageCount, 'process', 'process') : plural(pageCount, table ? 'onglet' : 'page')}`
              : ''}
          </ThemedText>
        )}
        {table && !picked && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Fichier choisi : {table.fileName}
          </ThemedText>
        )}
        <PrimaryButton
          label="Importer"
          onPress={() => submit()}
          disabled={!chosen}
          accessibilityLabel={chosen ? 'Importer le process' : 'Importer, choisissez d’abord un fichier'}
        />
        {chosen && (
          <Pressable
            onPress={() => submit(true)}
            accessibilityRole="button"
            accessibilityHint="Importe le process puis ouvre l’éditeur pour corriger la lecture"
            style={styles.secondary}>
            <ThemedText type="link" style={{ color: theme.link }}>
              Importer et corriger
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SourceCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.source,
        {
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          borderColor: selected ? theme.primary : theme.fieldBorder,
          borderWidth: selected ? 2 : 1,
        },
      ]}>
      <View style={[styles.sourceIcon, { backgroundColor: theme.primaryBackground }]}>
        <SymbolView name={icon} size={24} tintColor={theme.link} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold" style={styles.sourceTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  sources: { gap: Spacing.two },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: { fontSize: 16 },
  flex: { flex: 1 },
  card: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  preview: { gap: Spacing.one, padding: Spacing.three },
  badges: { flexDirection: 'row', marginTop: Spacing.one },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  noticeText: { flex: 1, gap: Spacing.half },
  footer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
