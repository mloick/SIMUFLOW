/**
 * La langue du téléphone (ou du navigateur), lue par l'API Intl intégrée à
 * Hermes et aux navigateurs : pas de module natif à ajouter. Remplacée dans
 * les tests par jest/langue-fr.js.
 */
export function deviceLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? '';
  } catch {
    return '';
  }
}
