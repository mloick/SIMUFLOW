/**
 * Textes de l'écran de connexion : vérification des champs avant l'envoi,
 * et traduction en français des erreurs renvoyées par Supabase Auth.
 */

/** Longueur minimale d'un mot de passe (la valeur par défaut de Supabase). */
export const PASSWORD_MIN_LENGTH = 6;

export type Credentials = { email: string; password: string };

/** Un problème dans les champs, ou `null` si on peut envoyer. */
export function checkCredentials({ email, password }: Credentials, mode: 'connexion' | 'creation'): string | null {
  if (!email.trim()) return 'Saisissez votre adresse e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Cette adresse e-mail n'est pas valide.";
  if (!password) return 'Saisissez votre mot de passe.';
  if (mode === 'creation' && password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  return null;
}

/** Ce que l'on lit d'une erreur Supabase Auth. */
export type AuthErrorLike = { code?: string; name?: string; status?: number; message?: string };

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
  email_not_confirmed: "Confirmez d'abord votre adresse : ouvrez le lien reçu par e-mail.",
  user_already_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  email_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  weak_password: `Mot de passe trop faible : au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  email_address_invalid: "Cette adresse e-mail n'est pas acceptée.",
  over_email_send_rate_limit: "Trop d'e-mails envoyés. Réessayez dans une heure.",
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
  signup_disabled: 'La création de compte est fermée pour le moment.',
};

export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  // Pas de réponse du serveur : réseau coupé ou serveur injoignable.
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Serveur injoignable : vérifiez la connexion Internet.';
  }
  return 'La connexion a échoué. Réessayez.';
}
