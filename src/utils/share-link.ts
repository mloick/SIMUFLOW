import { Share } from 'react-native';

/** Envoie un lien par la feuille de partage du téléphone (Messages, Mail…). */
export async function shareLink(message: string, _url: string): Promise<'partagé' | 'copié'> {
  await Share.share({ message });
  return 'partagé';
}
