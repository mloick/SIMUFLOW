/**
 * Textes de l'écran de connexion : vérification des champs avant l'envoi,
 * et traduction en français des erreurs renvoyées par Supabase Auth.
 */

/** Longueur minimale d'un mot de passe (la valeur par défaut de Supabase). */
export const PASSWORD_MIN_LENGTH = 6;

export type Credentials = { email: string; password: string };

/** Un problème dans l'adresse e-mail, ou `null`. */
export function checkEmail(email: string): string | null {
  if (!email.trim()) return 'Saisissez votre adresse e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Cette adresse e-mail n'est pas valide.";
  return null;
}

/** Un problème dans les champs, ou `null` si on peut envoyer. */
export function checkCredentials({ email, password }: Credentials, mode: 'connexion' | 'creation'): string | null {
  const emailProblem = checkEmail(email);
  if (emailProblem) return emailProblem;
  if (!password) return 'Saisissez votre mot de passe.';
  if (mode === 'creation' && password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  return null;
}

/** Mot de passe oublié : le code reçu par e-mail et le nouveau mot de passe. */
export type PasswordReset = { email: string; code: string; password: string };

/** Le code reçu par e-mail : des chiffres seulement (6 par défaut chez Supabase), espaces tolérés. */
export function cleanCode(code: string): string {
  return code.replace(/\s/g, '');
}

/** Un problème dans le formulaire « Mot de passe oublié », ou `null`. */
export function checkPasswordReset({ email, code, password }: PasswordReset): string | null {
  const emailProblem = checkEmail(email);
  if (emailProblem) return emailProblem;
  if (!cleanCode(code)) return 'Saisissez le code reçu par e-mail.';
  if (!/^\d{6,10}$/.test(cleanCode(code))) return 'Le code est fait de 6 chiffres, sans lettres.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le nouveau mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
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
  otp_expired: 'Code incorrect ou expiré. Demandez un nouveau code.',
  same_password: "Choisissez un mot de passe différent de l'ancien.",
};

export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  // Pas de réponse du serveur : réseau coupé ou serveur injoignable.
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Serveur injoignable : vérifiez la connexion Internet.';
  }
  return 'La connexion a échoué. Réessayez.';
}
