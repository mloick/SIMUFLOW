import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { SymbolView } from '@/components/symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Bouton « ? » de la refonte : remplace les longues phrases d'aide sous un
 * réglage. Le toucher ouvre une feuille en bas de l'écran avec le titre et
 * l'explication ; on la ferme par « Compris », en touchant à côté, ou avec le
 * geste retour. Avec « Réduire les animations », la feuille apparaît en fondu.
 */
export function HelpButton({ title, text }: { title: string; text: string }) {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.help.explain(title)}
        onPress={() => setOpen(true)}
        hitSlop={4}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
        <SymbolView
          name={{ ios: 'questionmark', android: 'question_mark' }}
          size={16}
          weight="bold"
          tintColor={theme.textSecondary}
        />
      </Pressable>
      <HelpSheet visible={open} title={title} text={text} onClose={() => setOpen(false)} />
    </>
  );
}

/** La feuille d'explication, seule : pour l'ouvrir depuis un autre bouton. */
export function HelpSheet({
  visible,
  title,
  text,
  onClose,
}: {
  visible: boolean;
  title: string;
  text: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.help.close}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{text}</ThemedText>
          </ScrollView>
          <PrimaryButton label={t.help.ok} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 10, 18, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '80%',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  content: {
    gap: Spacing.two,
  },
  title: {
    fontWeight: 800,
  },
});
