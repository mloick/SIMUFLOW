import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

/**
 * Écran Scanner (maquette, écran 6) : on cadre un tableau de process (une
 * colonne par information : étape, acteur, délai) et on le photographie.
 * L'écran reste sombre, comme une app photo, quel que soit le thème.
 *
 * Étape 10a : l'appareil photo, son autorisation et la photo. La lecture du
 * texte de la photo (module natif) viendra ensuite.
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

  const shoot = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.8 });
      setPhoto(picture.uri);
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
    body = (
      <>
        <View style={styles.frame}>
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel="Photo du tableau"
          />
        </View>
        <ThemedText style={styles.status} accessibilityLiveRegion="polite">
          Photo prise. La lecture du texte arrive à l’étape suivante.
        </ThemedText>
        <View style={styles.full}>
          <PrimaryButton label="Reprendre la photo" onPress={() => setPhoto(null)} />
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
