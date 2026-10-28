import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="Profil"
      description="Le compte, les préférences et la suppression du compte."
      links={[{ label: 'Se connecter', href: '/connexion' }]}
    />
  );
}
