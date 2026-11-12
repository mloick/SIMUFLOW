import { Alert } from 'react-native';

/**
 * Demande une confirmation avant une action qui retire quelque chose.
 * Sur téléphone : la boîte de dialogue du système. Sur le web, voir confirm.web.ts.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  cancelLabel = 'Annuler',
) {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
