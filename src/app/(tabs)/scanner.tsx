import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ScannerScreen() {
  return (
    <PlaceholderScreen
      title="Scanner"
      description="Photographier un tableau de process (étape, acteur, délai) pour le transformer en workflow."
      links={[{ label: 'Voir le résultat d’un scan', href: { pathname: '/process/[id]', params: { id: 'scan' } } }]}
    />
  );
}
