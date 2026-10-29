import { Pressable, StyleSheet, View } from 'react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { DEMO_SCENARIOS, setDemoScenario, useDemoScenario } from '@/data/process-store';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="Profil"
      description="Le compte, les préférences et la suppression du compte."
      links={[{ label: 'Se connecter', href: '/connexion' }]}>
      {__DEV__ && <DemoScenarioPicker />}
    </PlaceholderScreen>
  );
}

/** Mode développement : force un état de la liste des process, pour le montrer. */
function DemoScenarioPicker() {
  const theme = useTheme();
  const current = useDemoScenario();

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        Démo · état de la liste des process
      </ThemedText>
      <View style={styles.options} accessibilityRole="radiogroup">
        {DEMO_SCENARIOS.map((option) => {
          const selected = option.value === current;
          return (
            <Pressable
              key={option.value}
              onPress={() => setDemoScenario(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.option,
                { backgroundColor: selected ? theme.primary : theme.surface, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
});
