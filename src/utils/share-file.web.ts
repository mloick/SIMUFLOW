/**
 * Sur le web : téléchargement du fichier, et impression (« Enregistrer en PDF »)
 * pour le PDF.
 */

export async function shareTextFile(fileName: string, content: string, mimeType: string, _title: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sharePdf(_fileName: string, html: string, _title: string) {
  const page = window.open('', '_blank');
  if (!page) throw new Error('Autorisez les fenêtres pour ce site, puis réessayez.');
  page.document.write(html);
  page.document.close();
  page.focus();
  page.print();
}
