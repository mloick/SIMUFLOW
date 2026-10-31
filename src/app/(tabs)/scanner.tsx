import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { groupRows, type TableRow } from '@/scan/rows';
import { findTable, type ScannedTable } from '@/scan/table';
import { plural } from '@/utils/format';

import { isTextRecognitionAvailable, recognizeText } from '../../../modules/text-recognition';

/**
 * Écran Scanner (maquette, écran 6) : on cadre un tableau de process (une
 * colonne par information : étape, acteur, délai) et on le photographie.
 * L'écran reste sombre, comme une app photo, quel que soit le thème.
 *
 * Après la photo, le module natif modules/text-recognition (Vision sur iOS)
 * recadre la photo sur le document et en lit le texte, sur le téléphone. Le
 * texte est rangé en lignes (src/scan/rows.ts), puis seul le tableau est gardé,
 * à partir de sa ligne d'en-tête (src/scan/table.ts). La transformation en
 * process viendra ensuite.
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
      setError('La photo n’a pas pu être prise. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (!permission) {
    body = <ActivityIndicator color={SCAN.text} style={styles.center} />;
  } else if (!permission.granted) {
    body = (
      <View style={styles.permission}>
        <View style={styles.permissionIcon} importantForAccessibility="no-hide-descendants">
          <SymbolView name={{ ios: 'camera', android: 'photo_camera' }} size={32} tintColor={SCAN.accent} />
        </View>
        <ThemedText type="subtitle" style={[styles.light, styles.centerText]} accessibilityRole="header">
          Autoriser l’appareil photo
        </ThemedText>
        <ThemedText style={[styles.muted, styles.centerText]}>
          {permission.canAskAgain
            ? 'SimuFlow utilise l’appareil photo seulement pour lire un tableau de process. Les photos restent sur votre téléphone.'
            : 'L’accès a été refusé. Autorisez l’appareil photo pour SimuFlow dans les réglages du téléphone.'}
        </ThemedText>
        <PrimaryButton
          label={permission.canAskAgain ? 'Autoriser' : 'Ouvrir les réglages'}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        />
      </View>
    );
  } else if (photo) {
    const done = reading.state === 'done' ? reading : null;
    body = (
      <>
        <View style={styles.frame}>
          <Image
            source={{ uri: done?.cropped ?? photo }}
            style={StyleSheet.absoluteFill}
            contentFit={done?.cropped ? 'contain' : 'cover'}
            accessibilityLabel={done?.cropped ? 'Photo recadrée sur le document' : 'Photo du tableau'}
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
          {readingText(reading)}
        </ThemedText>
        {done?.table && done.table.rows.length > 0 && <TablePreview table={done.table} />}
        {done && !done.table && done.rows.length > 0 && (
          <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent} accessibilityLabel="Texte lu">
            {done.rows.map((row, index) => (
              <ThemedText key={index} type="small" style={styles.light} numberOfLines={2}>
                {row.cells.join('  ·  ')}
              </ThemedText>
            ))}
          </ScrollView>
        )}
        <View style={styles.full}>
          <PrimaryButton label="Reprendre la photo" onPress={retake} />
        </View>
      </>
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
              onMountError={() => setError('L’appareil photo n’a pas pu démarrer.')}
              accessibilityLabel="Aperçu de l’appareil photo"
            />
          )}
          <Corners />
        </View>
        <ThemedText
          style={[styles.status, error && styles.error]}
          accessibilityLiveRegion="polite"
          accessibilityRole={error ? 'alert' : undefined}>
          {error ?? 'Tenez le téléphone au-dessus du tableau, bien à plat.'}
        </ThemedText>
        <View style={styles.controls}>
          <View style={styles.side} />
          <Pressable
            onPress={shoot}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="Prendre la photo"
            accessibilityState={{ disabled: !ready || busy }}
            style={({ pressed }) => [styles.shutter, { opacity: !ready || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            onPress={() => setTorch((on) => !on)}
            accessibilityRole="switch"
            accessibilityLabel="Lampe"
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
          Scanner
        </ThemedText>
        <ThemedText style={styles.muted}>
          Cadrez un tableau avec une colonne par information : étape, acteur, délai.
        </ThemedText>
        {body}
      </View>
    </View>
  );
}

type Reading =
  | { state: 'idle' | 'reading' | 'error' | 'unavailable' }
  | { state: 'done'; rows: TableRow[]; table: ScannedTable | null; cropped?: string };

function readingText(reading: Reading): string {
  switch (reading.state) {
    case 'reading':
      return 'Lecture du tableau…';
    case 'error':
      return 'Le texte n’a pas pu être lu. Reprenez la photo, bien de face et nette.';
    case 'unavailable':
      return 'Photo prise. La lecture du texte n’est pas encore disponible sur cet appareil.';
    case 'done': {
      const { table, rows } = reading;
      if (rows.length === 0) return 'Aucun texte trouvé. Rapprochez-vous du tableau et reprenez la photo.';
      if (!table) return 'Pas de ligne de titres trouvée (Étape, Acteur, Délai…). Voici tout le texte lu :';
      if (table.rows.length === 0) return 'Titres trouvés, mais aucune ligne en dessous. Reprenez la photo.';
      const around = table.ignored > 0 ? ` Texte autour ignoré : ${plural(table.ignored, 'ligne')}.` : '';
      return `Tableau trouvé : ${plural(table.rows.length, 'étape')}.${around}`;
    }
    default:
      return 'Photo prise.';
  }
}

/** Le tableau trouvé : les titres de colonnes, puis une ligne par étape. */
function TablePreview({ table }: { table: ScannedTable }) {
  const flex = (index: number) =>
    table.columns[index].kind === 'step' ? 2.2 : table.columns[index].kind === 'number' ? 0.5 : 1;
  return (
    <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent} accessibilityLabel="Tableau trouvé">
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
