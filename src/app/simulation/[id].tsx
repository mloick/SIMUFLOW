import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function SimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PlaceholderScreen
      title="Simulation"
      description={`Rejouer le process « ${id} » pas à pas, en choisissant la branche à chaque décision.`}
    />
  );
}
