/**
 * Version web : ouvre l'appareil photo du téléphone (attribut `capture`) ou,
 * sur ordinateur, le choix d'une image. Rend l'adresse locale de l'image
 * (`blob:`), ou `null` si rien n'a été choisi.
 */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      resolve(file ? URL.createObjectURL(file) : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
