import { useWindowDimensions } from 'react-native';

/** À partir de cette taille (×1,5 la taille normale), les écrans passent en mise en page « grands textes ». */
export const LARGE_TEXT_SCALE = 1.5;

/**
 * Le texte est-il agrandi dans les réglages du téléphone (Taille du texte, Police plus grande) ?
 * Les écrans s'en servent pour empiler ce qui tient côte à côte en taille normale.
 */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}
