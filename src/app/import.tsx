import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ImportScreen() {
  return (
    <PlaceholderScreen
      title="Importer"
      description="Choisir un fichier draw.io ou JSON, ou scanner un tableau."
      links={[{ label: 'Scanner un tableau', href: '/scanner' }]}
    />
  );
}
