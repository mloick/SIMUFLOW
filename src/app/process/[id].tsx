import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ProcessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PlaceholderScreen
      title={`Process « ${id} »`}
      description="Le détail d’un process : ses étapes, ses acteurs et les anomalies détectées."
      links={[{ label: 'Lancer la simulation', href: { pathname: '/simulation/[id]', params: { id } } }]}
    />
  );
}
