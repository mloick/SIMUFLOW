/**
 * Sur téléphone, le Scanner prend la photo avec expo-camera : ce choix d'image
 * ne sert que dans le navigateur (pick-photo.web.ts).
 */
export async function pickPhoto(): Promise<string | null> {
  return null;
}
