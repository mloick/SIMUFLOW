/** Sur le web : la feuille de partage du navigateur s'il en a une, sinon le lien est copié. */
export async function shareLink(message: string, url: string): Promise<'partagé' | 'copié'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message });
      return 'partagé';
    } catch {
      // Partage annulé ou refusé : on copie.
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copié';
}
