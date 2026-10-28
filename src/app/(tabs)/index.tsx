import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ProcessListScreen() {
  return (
    <PlaceholderScreen
      title="Process"
      description="La liste des process importés, avec leur état de diagnostic."
      links={[
        { label: 'Ouvrir un process d’exemple', href: { pathname: '/process/[id]', params: { id: 'exemple' } } },
        { label: 'Importer un process', href: '/import' },
      ]}
    />
  );
}
