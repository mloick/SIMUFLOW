/**
 * Textes de l'écran de connexion : vérification des champs avant l'envoi,
 * et traduction en français des erreurs renvoyées par Supabase Auth.
 */

/**
 * Longueur minimale d'un nouveau mot de passe. La même valeur est réglée dans Supabase
 * (Authentication, longueur minimale du mot de passe), qui la vérifie aussi.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Les symboles que Supabase compte (réglage « lowercase, uppercase, digits and symbols »). */
const SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';

/** La règle d'un nouveau mot de passe, affichée sous le champ. */
export const PASSWORD_RULE = `Au moins ${PASSWORD_MIN_LENGTH} caractères, avec une minuscule, une majuscule, un chiffre et un symbole.`;

/**
 * Ce qui manque à un nouveau mot de passe, ou `null`. Mêmes exigences que le réglage
 * Supabase du projet (longueur et types de caractères), qui les vérifie aussi.
 */
export function passwordProblem(password: string): string | null {
  const missing = [
    !/[a-z]/.test(password) && 'une minuscule',
    !/[A-Z]/.test(password) && 'une majuscule',
    !/[0-9]/.test(password) && 'un chiffre',
    ![...password].some((char) => SYMBOLS.includes(char)) && 'un symbole (par exemple ! ? # -)',
  ].filter((item): item is string => Boolean(item));
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (missing.length === 0) return null;
  const list =
    missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} et ${missing[missing.length - 1]}`;
  return `Il manque au mot de passe ${list}.`;
}

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
  return mode === 'creation' ? passwordProblem(password) : null;
}

/** Un problème dans le nouveau mot de passe (mot de passe oublié), ou `null`. */
export function checkNewPassword(password: string): string | null {
  return passwordProblem(password);
}

/** Ce que contient le lien « Mot de passe oublié » qui rouvre l'app. */
export type RecoveryLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string };

/**
 * Lit le lien de l'e-mail « Mot de passe oublié », après son passage chez Supabase :
 * `simuflow://nouveau-mot-de-passe#access_token=…&refresh_token=…&type=recovery`,
 * ou `#error=…&error_code=otp_expired` si le lien a expiré. `null` si ce n'en est pas un.
 */
export function parseRecoveryLink(url: string | null): RecoveryLink | null {
  if (!url) return null;
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const raw = hash >= 0 ? url.slice(hash + 1) : query >= 0 ? url.slice(query + 1) : '';
  const params = new URLSearchParams(raw);
  const errorCode = params.get('error_code') ?? params.get('error');
  if (errorCode) return { kind: 'error', message: authErrorMessage({ code: errorCode }) };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken };
  return null;
}

/** Ce que l'on lit d'une erreur Supabase Auth. */
export type AuthErrorLike = { code?: string; name?: string; status?: number; message?: string };

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
  email_not_confirmed: "Confirmez d'abord votre adresse : ouvrez le lien reçu par e-mail.",
  user_already_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  email_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  weak_password: `Mot de passe trop faible. ${PASSWORD_RULE}`,
  email_address_invalid: "Cette adresse e-mail n'est pas acceptée.",
  over_email_send_rate_limit: "Trop d'e-mails envoyés. Réessayez dans une heure.",
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
  signup_disabled: 'La création de compte est fermée pour le moment.',
  otp_expired: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
  access_denied: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
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
