import * as DocumentPicker from 'expo-document-picker';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnonymizeOption } from '@/components/anonymize-option';
import { Badge } from '@/components/badge';
import { diagnosticBadge } from '@/components/process-card';
import { PressableScale } from '@/components/pressable-scale';
import { PrimaryButton } from '@/components/primary-button';
import { SymbolView, type SymbolViewProps } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { ColumnPicker } from '@/components/column-picker';
import { SituationList } from '@/components/situation-list';
import { TextSource } from '@/components/text-source';
import { WorkbookPreview } from '@/components/workbook-preview';
import { fontFaceFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { readFormBundle } from '@/data/form-chain';
import { showForm } from '@/data/form-store';
import { addImportedProcess } from '@/data/process-store';
import { addReadingRules, applyReadingRules, getLearnedHeaders } from '@/data/rules-store';
import { anonymizeProcess, parseHiddenWords, summarize } from '@/domain';
import {
  ImportError,
  importProcessFile,
  learnColumnRules,
  parseProcessText,
  parseVisio,
  type ImportResult,
} from '@/import';
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
import { readPickedBytes, readPickedFile } from '@/utils/read-file';
import { getT, useT } from '@/i18n';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
/** Un classeur peut contenir des images, qui ne sont pas lues : on accepte plus gros. */
const MAX_TABLE_SIZE = 20 * 1024 * 1024;

type FileKind = 'drawio' | 'bpmn' | 'visio' | 'json' | 'tableau' | 'formulaire' | 'texte';

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
  const t = useT();
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

  const [anonymous, setAnonymous] = useState(false);
  const [hiddenWords, setHiddenWords] = useState('');
  /** Texte collé ou lu dans un .txt (source « Texte »). */
  const [text, setText] = useState('');

  const chosen = picked?.result.processes[page];
  const anonymizer = useMemo(
    () => (chosen && anonymous ? anonymizeProcess(chosen, { hidden: parseHiddenWords(hiddenWords) }) : null),
    [chosen, anonymous, hiddenWords],
  );
  /** Le process tel qu'il sera importé : anonymisé si la case est cochée. */
  const shown = anonymizer?.process ?? chosen;
  const summary = useMemo(() => (shown ? summarize(shown) : null), [shown]);

  /**
   * Formulaire et workflow : un ou deux fichiers. Le formulaire s'ouvre pour
   * être rempli ; sa réponse au choix de la situation mène ensuite au process.
   */
  const openFormBundle = async (assets: DocumentPicker.DocumentPickerAsset[]) => {
    setPicked(null);
    setTable(null);
    setChoosing(null);
    try {
      const bundle = await readFormBundle(assets);
      setError(null);
      showForm(bundle.form, { source: bundle.source, workflow: bundle.workflow });
      router.push('/formulaire');
    } catch (cause) {
      setError(cause instanceof ImportError ? cause.message : getT().importer.filesUnreadable);
    }
  };

  const pick = async (nextKind: FileKind) => {
    setKind(nextKind);
    const selection = await DocumentPicker.getDocumentAsync({
      type:
        nextKind === 'json' ? ['application/json', 'text/plain'] : nextKind === 'tableau' ? TABLE_FILE_TYPES : '*/*',
      copyToCacheDirectory: true,
      multiple: nextKind === 'formulaire' || nextKind === 'tableau',
    });
    if (selection.canceled) return;
    // Deux fichiers choisis ensemble : un formulaire et son workflow.
    if (nextKind === 'formulaire' || selection.assets.length > 1) {
      await openFormBundle(selection.assets);
      return;
    }
    const asset = selection.assets[0];
    if (nextKind === 'tableau') {
      await pickTable(asset);
      return;
    }
    setTable(null);
    try {
      if (asset.size && asset.size > MAX_FILE_SIZE) throw new ImportError(getT().importer.tooBig(5));
      // Un .vsdx est une archive zip : il se lit en octets, pas en texte.
      const read =
        nextKind === 'visio' || /\.vsdx$/i.test(asset.name)
          ? parseVisio(await readPickedBytes(asset), asset.name, newImportId())
          : importProcessFile(asset.name, await readPickedFile(asset), newImportId());
      const { result, applied } = applyReadingRules(read);
      setPicked({ fileName: asset.name, result, applied });
      setPage(0);
      setName(result.processes[0].name);
      setNameMissing(false);
      setError(null);
    } catch (cause) {
      setPicked(null);
      setError(cause instanceof ImportError ? cause.message : getT().importer.fileUnreadable);
    }
  };

  /** Source « Texte » : lit le process écrit, une ligne par étape. */
  const chooseText = () => {
    setKind('texte');
    setPicked(null);
    setTable(null);
    setChoosing(null);
    setError(null);
  };

  const readText = (content: string, fileName?: string) => {
    setTable(null);
    try {
      const fallback = fileName
        ? fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        : getT().importer.writtenProcess;
      const { result, applied } = applyReadingRules(parseProcessText(content, fallback, newImportId()));
      setPicked({ fileName: fileName ?? 'Texte', result, applied });
      setPage(0);
      setName(result.processes[0].name);
      setNameMissing(false);
      setError(null);
    } catch (cause) {
      setPicked(null);
      setError(cause instanceof ImportError ? cause.message : getT().importer.textUnreadable);
    }
  };

  const pickTable = async (asset: DocumentPicker.DocumentPickerAsset) => {
    setPicked(null);
    setChoosing(null);
    try {
      if (asset.size && asset.size > MAX_TABLE_SIZE) throw new ImportError(getT().importer.tooBig(20));
      const workbook = readTableFile(asset.name, await readPickedBytes(asset));
      const learned = getLearnedHeaders();
      const report = describeWorkbook(workbook, learned);
      const { situations, skipped } = workbookToSituations(workbook);
      const form =
        report.kind === 'formulaire' || report.kind === 'formulaire-workflow' ? readFormTemplate(workbook) : null;
      setTable({
        fileName: asset.name,
        workbook,
        report,
        warnings: workbook.warnings,
        form,
        situations,
        skipped,
      });
      // Les onglets « process » deviennent des process à importer, comme les pages d'un draw.io,
      // puis chaque situation d'un workflow avec SLA et OLA.
      const importId = newImportId();
      const read = workbookToProcesses(workbook, importId, learned);
      // Un formulaire se remplit d'abord : ses situations mènent à leur process après l'envoi.
      if (form) read.processes = [];
      const situationsFrom = read.processes.length;
      if (!form) read.processes.push(...situationsToProcesses(situations, `${importId}-situation`).processes);
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
      setError(cause instanceof ImportError ? cause.message : getT().importer.fileUnreadable);
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
    addImportedProcess({ ...(anonymizer?.process ?? chosen), name: anonymizer ? anonymizer.text(trimmed) : trimmed });
    router.replace({ pathname: '/process/[id]', params: { id: chosen.id } });
    if (correct) router.push({ pathname: '/process/modifier/[id]', params: { id: chosen.id } });
  };

  /** Formulaire et workflow dans le même classeur : ils sont liés d'office. */
  const openTableForm = () => {
    if (!table?.form) return;
    showForm(table.form, {
      source: table.fileName,
      workflow:
        table.situations.length > 0
          ? { kind: 'situations', source: table.fileName, situations: table.situations }
          : null,
    });
    router.push('/formulaire');
  };

  const pageCount = picked?.result.processes.length ?? 0;
  /** Les situations viennent après les process des onglets « process ». */
  const sheetPageCount = picked?.situationsFrom ?? pageCount;
  const situationCount = pageCount - sheetPageCount;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.importer.title,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>{t.common.cancel}</ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.sources}>
          <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
            {t.importer.sourcesLabel}
          </ThemedText>
          <View style={styles.grid}>
            {SOURCES.map((source) => (
              <SourceTile
                key={source.id}
                icon={source.icon}
                title={t.importer.sources[source.id][0]}
                description={t.importer.sources[source.id][1]}
                selected={kind === source.id}
                onPress={() =>
                  source.id === 'scan'
                    ? router.replace('/scanner')
                    : source.id === 'texte'
                      ? chooseText()
                      : pick(source.id as Exclude<FileKind, 'texte'>)
                }
              />
            ))}
          </View>
          {kind !== 'texte' && (
            <View style={[styles.explain, { backgroundColor: kind ? theme.primaryBackground : theme.surfaceMuted }]}>
              <SymbolView
                name={{ ios: 'info.circle', android: 'info' }}
                size={18}
                tintColor={kind ? theme.link : theme.textSecondary}
              />
              <View style={styles.flex}>
                {kind && (
                  <ThemedText type="smallBold" style={{ color: theme.link }}>
                    {t.importer.sources[kind][0]}
                  </ThemedText>
                )}
                <ThemedText type="small" themeColor={kind ? 'text' : 'textSecondary'}>
                  {kind ? t.importer.explain[kind] : t.importer.pickHint}
                </ThemedText>
              </View>
            </View>
          )}
          {kind === 'texte' && <TextSource value={text} onChange={setText} onRead={readText} />}
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold" nativeID="nom-label">
            {t.importer.name}
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (text.trim()) setNameMissing(false);
            }}
            placeholder={picked ? undefined : t.importer.namePlaceholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t.importer.name}
            accessibilityHint={nameMissing ? t.importer.nameRequired : undefined}
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
              {t.importer.nameRequired}
            </ThemedText>
          )}
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
            onShowForm={openTableForm}
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
              {table ? t.importer.sheetToImport : t.importer.pageToImport}
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
                    {t.format.count(process.steps.length, t.words.step)}
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
              {t.importer.preview}
            </ThemedText>
            <View style={[styles.card, styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText>
                {[
                  t.format.count(summary.stepCount, t.words.step),
                  t.format.count(summary.decisionCount, t.words.decision),
                  t.format.count(summary.actors.length, t.words.actor),
                ].join(' · ')}
              </ThemedText>
              {summary.actors.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  {summary.actors.join(', ')}
                </ThemedText>
              )}
              <View style={styles.badges}>
                <Badge {...diagnosticBadge(t, summary)} />
              </View>
            </View>
            <AnonymizeOption
              checked={anonymous}
              onToggle={() => setAnonymous((value) => !value)}
              hidden={hiddenWords}
              onChangeHidden={setHiddenWords}
              result={
                anonymizer
                  ? t.importer.anonymized(
                      t.format.count(anonymizer.actorCount, t.importer.renamedActor),
                      anonymizer.text(name.trim()),
                    )
                  : undefined
              }
            />
            {picked && picked.applied.length > 0 && (
              <View
                style={[styles.notice, { backgroundColor: theme.primaryBackground }]}
                accessible
                accessibilityLabel={t.importer.correctedLabel(picked.applied.join(', '))}>
                <SymbolView
                  name={{ ios: 'wand.and.stars', android: 'auto_fix_high' }}
                  size={20}
                  tintColor={theme.link}
                />
                <View style={styles.noticeText}>
                  <ThemedText type="smallBold" style={{ color: theme.link }}>
                    {t.importer.corrected}
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
                    {t.importer.remarks}
                  </ThemedText>
                  {picked.result.warnings.map((warning) => (
                    <ThemedText key={warning} type="small" style={{ color: theme.warning }}>
                      {anonymizer ? anonymizer.text(warning) : warning}
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
            {kind === 'texte' && picked.fileName === 'Texte'
              ? t.importer.pastedText
              : t.importer.chosenFile(picked.fileName)}
            {pageCount > 1
              ? ` · ${t.format.count(pageCount, situationCount > 0 ? t.importer.process : table ? t.importer.sheet : t.importer.page)}`
              : ''}
          </ThemedText>
        )}
        {table && !picked && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {t.importer.chosenFile(table.fileName)}
          </ThemedText>
        )}
        {table?.form && !chosen ? (
          <PrimaryButton label={t.importer.fillForm} onPress={openTableForm} />
        ) : (
          <PrimaryButton
            label={t.importer.import}
            onPress={() => submit()}
            disabled={!chosen}
            accessibilityLabel={chosen ? t.importer.importLabel : t.importer.importDisabled}
          />
        )}
        {chosen && (
          <Pressable
            onPress={() => submit(true)}
            accessibilityRole="button"
            accessibilityHint={t.importer.importAndFixHint}
            style={styles.secondary}>
            <ThemedText type="link" style={{ color: theme.link }}>
              {t.importer.importAndFix}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Les 8 sources, dans l'ordre des tuiles. */
const SOURCES: { id: FileKind | 'scan'; icon: SymbolViewProps['name'] }[] = [
  { id: 'drawio', icon: { ios: 'doc', android: 'description' } },
  { id: 'bpmn', icon: { ios: 'point.3.connected.trianglepath.dotted', android: 'account_tree' } },
  { id: 'visio', icon: { ios: 'square.on.circle', android: 'schema' } },
  { id: 'tableau', icon: { ios: 'tablecells', android: 'table_chart' } },
  { id: 'formulaire', icon: { ios: 'list.bullet.rectangle', android: 'dynamic_form' } },
  { id: 'scan', icon: { ios: 'viewfinder', android: 'document_scanner' } },
  { id: 'texte', icon: { ios: 'text.alignleft', android: 'notes' } },
  { id: 'json', icon: { ios: 'curlybraces', android: 'data_object' } },
];

/** Tuile d'une source (refonte R12) : icône, nom et courte description ; la choisie est entourée. */
function SourceTile({
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
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ selected }}
      style={[
        styles.tile,
        {
          backgroundColor: selected ? theme.primaryBackground : theme.surface,
          borderColor: selected ? theme.primary : 'transparent',
        },
      ]}>
      <View style={[styles.tileIcon, { backgroundColor: selected ? theme.primary : theme.primaryBackground }]}>
        <SymbolView name={icon} size={22} tintColor={selected ? theme.onPrimary : theme.link} />
      </View>
      <ThemedText type="smallBold" style={styles.tileTitle} numberOfLines={2}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.tileText}>
        {description}
      </ThemedText>
    </PressableScale>
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
    minHeight: 50,
    borderRadius: Radius.medium,
    fontFamily: fontFaceFor(400),
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  sources: { gap: Spacing.three - Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three - Spacing.half * 3 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 120,
    gap: Spacing.one,
    padding: Spacing.three - Spacing.half,
    borderRadius: Radius.large - 2,
    borderWidth: 2,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  tileTitle: { fontWeight: 800 },
  tileText: { fontSize: 12, lineHeight: 16 },
  explain: {
    flexDirection: 'row',
    gap: Spacing.three - Spacing.half * 3,
    padding: Spacing.three - Spacing.half,
    borderRadius: Radius.medium,
  },
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
