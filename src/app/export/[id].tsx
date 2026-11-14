import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnonymizeOption } from '@/components/anonymize-option';
import { PrimaryButton } from '@/components/primary-button';
import { StateMessage } from '@/components/state-message';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { FamilyColorNames, FamilyColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getProcess } from '@/data/process-store';
import { anonymizeProcess, parseHiddenWords, type Process } from '@/domain';
import { exportFileName, exportText, MIME_TYPES, processToPdfHtml, type ExportFormat } from '@/export';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { overviewOf } from '@/simulation/families';
import { sharePdf, shareTextFile } from '@/utils/share-file';

const FORMATS: { value: ExportFormat; badge: string; title: string }[] = [
  { value: 'pdf', badge: 'PDF', title: 'PDF' },
  { value: 'drawio', badge: '.drawio', title: 'draw.io' },
  { value: 'bpmn', badge: '.bpmn', title: 'BPMN 2.0' },
  { value: 'json', badge: '{ }', title: 'JSON' },
];

/**
 * Modale « Exporter le schéma » (maquette, écran 12), ouverte depuis la
 * simulation : choisir le format, puis partager le fichier.
 */
export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const process = getProcess(id);
  const theme = useTheme();
  const t = useT();

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StateMessage
          icon={{ ios: 'exclamationmark.circle', android: 'error' }}
          tone="danger"
          title={t.share.notFound}
          message={t.share.notFoundText}
          action={{ label: t.share.back, onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <Exporter process={process} />;
}

function Exporter({ process }: { process: Process }) {
  const theme = useTheme();
  const t = useT();
  const x = t.exporter;
  const insets = useSafeAreaInsets();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [colorFamilies, setColorFamilies] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [hiddenWords, setHiddenWords] = useState('');
  const anonymizer = useMemo(
    () => (anonymous ? anonymizeProcess(process, { hidden: parseHiddenWords(hiddenWords) }) : null),
    [process, anonymous, hiddenWords],
  );
  const pathCount = useMemo(() => overviewOf(process, t).pathCount, [process, t]);
  // Le JSON et le BPMN ne gardent que les étapes et les liens : pas de couleurs.
  const colorable = format !== 'json' && format !== 'bpmn';

  const submit = async () => {
    setBusy(true);
    setError(null);
    // Anonymisé, le fichier ne garde ni les acteurs ni les mots masqués, jusque dans son nom.
    const shared = anonymizer?.process ?? process;
    const fileName = exportFileName(shared, format);
    const title = x.shareTitle(shared.name);
    try {
      // Couleurs claires : le fichier est fait pour une page blanche.
      const options = {
        colorFamilies: colorable && colorFamilies,
        colors: FamilyColors.light,
        colorNames: FamilyColorNames,
      };
      if (format === 'pdf') await sharePdf(fileName, processToPdfHtml(shared, options), title);
      else await shareTextFile(fileName, exportText(shared, format, options), MIME_TYPES[format], title);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : x.fileError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t.titles.export,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.link }}>{t.common.cancel}</ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary">
          {process.name} · {t.format.count(process.steps.length, t.words.step)} ·{' '}
          {t.format.count(pathCount, t.words.path)}
        </ThemedText>

        <View style={styles.formats} accessibilityRole="radiogroup" accessibilityLabel={x.formatLabel}>
          {FORMATS.map((option) => {
            const selected = option.value === format;
            return (
              <Pressable
                key={option.value}
                onPress={() => setFormat(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${option.title}. ${x.formats[option.value]}`}
                style={({ pressed }) => [
                  styles.format,
                  {
                    backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                    borderColor: selected ? theme.primary : theme.fieldBorder,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}>
                <View style={[styles.badge, { backgroundColor: theme.primaryBackground }]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.link, fontSize: option.badge.length > 4 ? 12 : 14 }}
                    maxFontSizeMultiplier={1.2}>
                    {option.badge}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" style={styles.formatTitle}>
                    {option.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {x.formats[option.value]}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {colorable && (
          <Pressable
            onPress={() => setColorFamilies((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: colorFamilies }}
            style={styles.check}>
            <View
              style={[
                styles.box,
                colorFamilies
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { borderColor: theme.fieldBorder, backgroundColor: theme.surface },
              ]}>
              {colorFamilies && (
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.onPrimary, lineHeight: 16 }}
                  maxFontSizeMultiplier={1}>
                  ✓
                </ThemedText>
              )}
            </View>
            <ThemedText>{x.colorFamilies}</ThemedText>
          </Pressable>
        )}

        <AnonymizeOption
          checked={anonymous}
          onToggle={() => setAnonymous((value) => !value)}
          hidden={hiddenWords}
          onChangeHidden={setHiddenWords}
          result={
            anonymizer
              ? x.sharedAs(t.format.count(anonymizer.actorCount, t.importer.renamedActor), anonymizer.process.name)
              : undefined
          }
        />

        {error && (
          <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]} accessibilityRole="alert">
            <SymbolView name={{ ios: 'exclamationmark.circle', android: 'error' }} size={20} tintColor={theme.danger} />
            <ThemedText type="small" style={[styles.flex, { color: theme.danger }]}>
              {error}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three, borderTopColor: theme.border }]}>
        <PrimaryButton
          label={busy ? x.preparing : x.share}
          onPress={submit}
          disabled={busy}
          accessibilityLabel={x.shareLabel(FORMATS.find((option) => option.value === format)?.title ?? '')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  formats: { gap: Spacing.two },
  format: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  badge: {
    width: 52,
    height: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatTitle: { fontSize: 16 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  footer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
