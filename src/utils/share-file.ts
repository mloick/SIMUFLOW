/**
 * Enregistre un fichier exporté dans le cache de l'app, puis ouvre la feuille
 * de partage du téléphone (Mail, Fichiers, AirDrop, messagerie…).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/** A4 en points (72 par pouce), pour expo-print. */
const A4 = { width: 595, height: 842 };

async function share(file: File, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage n’est pas disponible sur cet appareil.');
  // Sur iOS, un type MIME ajouterait une deuxième extension (« .drawio.xml ») :
  // l'extension du fichier suffit.
  await Sharing.shareAsync(file.uri, Platform.OS === 'android' ? { mimeType, dialogTitle: title } : {});
}

export async function shareTextFile(fileName: string, content: string, mimeType: string, title: string) {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.writeSync(content);
  await share(file, mimeType, title);
}

export async function sharePdf(fileName: string, html: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html, ...A4 });
  // expo-print donne un nom au hasard : on renomme le PDF d'après le process.
  const file = new File(Paths.cache, fileName);
  new File(uri).moveSync(file, { overwrite: true });
  await share(file, 'application/pdf', title);
}
