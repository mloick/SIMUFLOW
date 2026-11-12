/**
 * Sur le web, `Alert.alert` de React Native ne fait rien : le bouton semblait
 * ne pas marcher. On utilise la confirmation du navigateur.
 */
export function confirmAction(
  title: string,
  message: string,
  _confirmLabel: string,
  onConfirm: () => void,
  _cancelLabel = 'Annuler',
) {
  if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
}
