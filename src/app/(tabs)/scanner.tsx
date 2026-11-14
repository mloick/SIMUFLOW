import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { addImportedProcess } from '@/data/process-store';
import { applyReadingRules } from '@/data/rules-store';
import { groupRows, type TableRow } from '@/scan/rows';
import { findTable, type ScannedTable } from '@/scan/table';
import { tableToProcess } from '@/scan/to-process';
import { pickPhoto } from '@/utils/pick-photo';
import { useT, type Messages } from '@/i18n';

import { isTextRecognitionAvailable, recognizeText } from '../../../modules/text-recognition';

/**
 * Écran Scanner (maquette, écran 6) : on cadre un tableau de process (une
 * colonne par information : étape, acteur, délai) et on le photographie.
 * L'écran reste sombre, comme une app photo, quel que soit le thème.
 *
 * Après la photo, le module natif modules/text-recognition (Vision sur iOS)
 * recadre la photo sur le document et en lit le texte, sur le téléphone. Le
 * texte est rangé en lignes (src/scan/rows.ts), puis seul le tableau est gardé,
 * à partir de sa ligne d'en-tête (src/scan/table.ts). « Créer le process » le
 * transforme en process (src/scan/to-process.ts), ajouté à la liste.
 *
 * Dans le navigateur, pas de viseur : la photo est prise ou choisie avec
 * src/utils/pick-photo.web.ts, puis lue par Tesseract (index.web.ts du module).
 */

/** Couleurs fixes de l'écran photo (sombre dans les deux thèmes). */
const SCAN = {
  background: '#0b1621',
  frame: '#1c2a38',
  text: '#ffffff',
  textSecondary: '#b8c6d6',
  button: '#1f2e3d',
  accent: '#7cc7f0',
};

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const s = t.scanner;
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading>({ state: 'idle' });

  /** Lit le texte de la photo et le range en lignes de tableau. */
  const read = async (uri: string) => {
    if (!isTextRecognitionAvailable) return setReading({ state: 'unavailable' });
    setReading({ state: 'reading' });
    try {
      const { lines, uri: cropped } = await recognizeText(uri);
      const rows = groupRows(lines);
      setReading({ state: 'done', rows, table: findTable(rows), cropped });
    } catch {
      setReading({ state: 'error' });
    }
  };

  /** Crée le process du tableau trouvé et ouvre sa fiche ; avec `correct`, ouvre l'éditeur par-dessus. */
  const create = (table: ScannedTable, correct: boolean) => {
    const process = saveScannedProcess(table, t);
    retake();
    router.push({ pathname: '/process/[id]', params: { id: process.id } });
    if (correct) router.push({ pathname: '/process/modifier/[id]', params: { id: process.id } });
  };

  const retake = () => {
    setPhoto(null);
    setReady(false);
    setReading({ state: 'idle' });
  };

  const shoot = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.8 });
      setPhoto(picture.uri);
      read(picture.uri);
    } catch {
      setError(s.shotError);
    } finally {
      setBusy(false);
    }
  };

  /** Version web : prend ou choisit une photo, puis la lit. */
  const pick = async () => {
    const uri = await pickPhoto();
    if (!uri) return;
    setPhoto(uri);
    read(uri);
  };

  let body: ReactNode;
  if (photo) {
    const done = reading.state === 'done' ? reading : null;
    body = (
      <>
        <View style={styles.frame}>
          <Image
            source={{ uri: done?.cropped ?? photo }}
            style={StyleSheet.absoluteFill}
            contentFit={done?.cropped ? 'contain' : 'cover'}
            accessibilityLabel={done?.cropped ? s.croppedLabel : s.photoLabel}
          />
          {reading.state === 'reading' && (
            <View style={styles.veil}>
              <ActivityIndicator color={SCAN.text} />
            </View>
          )}
        </View>
        <ThemedText
          style={[styles.status, (reading.state === 'error' || done?.rows.length === 0) && styles.error]}
          accessibilityLiveRegion="polite">
          {readingText(reading, t)}
        </ThemedText>
        {done?.table && done.table.rows.length > 0 && <TablePreview table={done.table} label={s.tableFound} />}
        {done && !done.table && done.rows.length > 0 && (
          <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent} accessibilityLabel={s.textRead}>
            {done.rows.map((row, index) => (
              <ThemedText key={index} type="small" style={styles.light} numberOfLines={2}>
                {row.cells.join('  ·  ')}
              </ThemedText>
            ))}
          </ScrollView>
        )}
        {done?.table && done.table.rows.length > 0 ? (
          <View style={styles.actions}>
            <PrimaryButton label={s.create} onPress={() => create(done.table!, false)} />
            <View style={styles.links}>
              <Pressable onPress={retake} accessibilityRole="button" hitSlop={8} style={styles.link}>
                <ThemedText type="link" style={styles.accent}>
                  {s.retake}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => create(done.table!, true)}
                accessibilityRole="button"
                accessibilityHint={s.createFixHint}
                hitSlop={8}
                style={styles.link}>
                <ThemedText type="link" style={styles.accent}>
                  {s.createFix}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.full}>
            <PrimaryButton label={s.retake} onPress={retake} />
          </View>
        )}
      </>
    );
  } else if (Platform.OS === 'web') {
    // Dans le navigateur : pas d'aperçu en direct. Sur téléphone, le bouton ouvre
    // l'appareil photo ; sur ordinateur, le choix d'une image. Tesseract lit le
    // texte dans le navigateur (modules/text-recognition/index.web.ts).
    body = (
      <View style={styles.permission}>
        <View style={styles.permissionIcon} importantForAccessibility="no-hide-descendants">
          <SymbolView name={{ ios: 'camera', android: 'photo_camera' }} size={32} tintColor={SCAN.accent} />
        </View>
        <ThemedText type="subtitle" style={[styles.light, styles.centerText]} accessibilityRole="header">
          {s.webTitle}
        </ThemedText>
        <ThemedText style={[styles.muted, styles.centerText]}>{s.webText}</ThemedText>
        <PrimaryButton label={s.pick} onPress={pick} />
        <Pressable onPress={() => router.push('/import')} accessibilityRole="button" hitSlop={8} style={styles.link}>
          <ThemedText type="link" style={[styles.accent, styles.centerText]}>
            {s.importFile}
          </ThemedText>
        </Pressable>
      </View>
    );
  } else if (!permission) {
    body = <ActivityIndicator color={SCAN.text} style={styles.center} />;
  } else if (!permission.granted) {
    body = (
      <View style={styles.permission}>
        <View style={styles.permissionIcon} importantForAccessibility="no-hide-descendants">
          <SymbolView name={{ ios: 'camera', android: 'photo_camera' }} size={32} tintColor={SCAN.accent} />
        </View>
        <ThemedText type="subtitle" style={[styles.light, styles.centerText]} accessibilityRole="header">
          {s.allowTitle}
        </ThemedText>
        <ThemedText style={[styles.muted, styles.centerText]}>
          {permission.canAskAgain ? s.allowText : s.deniedText}
        </ThemedText>
        <PrimaryButton
          label={permission.canAskAgain ? s.allow : s.openSettings}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        />
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.frame}>
          {focused && (
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              onCameraReady={() => setReady(true)}
              onMountError={() => setError(s.cameraError)}
              accessibilityLabel={s.preview}
            />
          )}
          <Corners />
        </View>
        <ThemedText
          style={[styles.status, error && styles.error]}
          accessibilityLiveRegion="polite"
          accessibilityRole={error ? 'alert' : undefined}>
          {error ?? s.hold}
        </ThemedText>
        <View style={styles.controls}>
          <View style={styles.side} />
          <Pressable
            onPress={shoot}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel={s.shoot}
            accessibilityState={{ disabled: !ready || busy }}
            style={({ pressed }) => [styles.shutter, { opacity: !ready || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            onPress={() => setTorch((on) => !on)}
            accessibilityRole="switch"
            accessibilityLabel={s.torch}
            accessibilityState={{ checked: torch }}
            style={[styles.side, styles.sideButton, torch && { backgroundColor: SCAN.accent }]}>
            <SymbolView
              name={{ ios: torch ? 'bolt.fill' : 'bolt', android: torch ? 'flash_on' : 'flash_off' }}
              size={24}
              tintColor={torch ? SCAN.background : SCAN.text}
            />
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
      ]}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.light} accessibilityRole="header">
          {s.title}
        </ThemedText>
        <ThemedText style={styles.muted}>{s.intro}</ThemedText>
        {body}
      </View>
    </View>
  );
}

/** Transforme le tableau en process (règles de lecture apprises comprises) et l'ajoute à la liste. */
function saveScannedProcess(table: ScannedTable, t: Messages) {
  const name = table.title ?? t.scanner.defaultName(new Date().toLocaleDateString(t.common.locale));
  const { result } = applyReadingRules(tableToProcess(table, name, `scan-${Date.now()}`));
  const process = result.processes[0];
  addImportedProcess(process);
  return process;
}

type Reading =
  | { state: 'idle' | 'reading' | 'error' | 'unavailable' }
  | { state: 'done'; rows: TableRow[]; table: ScannedTable | null; cropped?: string };

function readingText(reading: Reading, t: Messages): string {
  const s = t.scanner;
  switch (reading.state) {
    case 'reading':
      return Platform.OS === 'web' ? s.readingWeb : s.reading;
    case 'error':
      return s.readError;
    case 'unavailable':
      return s.unavailable;
    case 'done': {
      const { table, rows } = reading;
      if (rows.length === 0) return s.noText;
      if (!table) return s.noHeader;
      if (table.rows.length === 0) return s.noRows;
      const around = table.ignored > 0 ? s.ignored(t.format.count(table.ignored, t.words.row)) : '';
      return s.found(table.title ?? null, t.format.count(table.rows.length, t.words.step)) + around;
    }
    default:
      return s.taken;
  }
}

/** Le tableau trouvé : les titres de colonnes, puis une ligne par étape. */
function TablePreview({ table, label }: { table: ScannedTable; label: string }) {
  const flex = (index: number) =>
    table.columns[index].kind === 'step' ? 2.2 : table.columns[index].kind === 'number' ? 0.5 : 1;
  return (
    <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent} accessibilityLabel={label}>
      <View style={styles.tableRow}>
        {table.columns.map((column, index) => (
          <ThemedText key={index} type="smallBold" style={[styles.accent, { flex: flex(index) }]} numberOfLines={1}>
            {column.label}
          </ThemedText>
        ))}
      </View>
      {table.rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow}>
          {row.map((cell, index) => (
            <ThemedText key={index} type="small" style={[cell ? styles.light : styles.muted, { flex: flex(index) }]}>
              {cell || '–'}
            </ThemedText>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/** Les quatre coins du viseur, comme dans la maquette. */
function Corners() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
}

const CORNER = 36;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCAN.background },
  content: {
    flex: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  light: { color: SCAN.text },
  muted: { color: SCAN.textSecondary },
  center: { flex: 1 },
  centerText: { textAlign: 'center' },
  frame: {
    flex: 1,
    minHeight: 240,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: SCAN.frame,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: SCAN.text },
  topLeft: { top: Spacing.three, left: Spacing.three, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: Spacing.three, right: Spacing.three, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: Spacing.three, left: Spacing.three, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: Spacing.three, right: Spacing.three, borderBottomWidth: 3, borderRightWidth: 3 },
  status: { color: SCAN.accent },
  error: { color: '#f4a49c' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  full: { alignSelf: 'stretch' },
  actions: { alignSelf: 'stretch', gap: Spacing.two },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { minHeight: 44, justifyContent: 'center' },
  veil: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,22,33,0.5)',
  },
  rows: { maxHeight: 220, borderRadius: Radius.small, backgroundColor: SCAN.frame },
  rowsContent: { gap: Spacing.one, padding: Spacing.three },
  tableRow: { flexDirection: 'row', gap: Spacing.two },
  accent: { color: SCAN.accent },
  side: { width: 48, height: 48 },
  sideButton: {
    borderRadius: Radius.medium,
    backgroundColor: SCAN.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: SCAN.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: SCAN.text },
  permission: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  permissionIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SCAN.button,
  },
});
