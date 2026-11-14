/**
 * Profil d'un compte : prénom, nom, identifiant unique (« julie.martin ») et
 * rôle déclaré. L'identifiant servira à inviter quelqu'un sur un process.
 * Fonctions pures, testées dans __tests__/profile.test.ts.
 */

import { getT } from '@/i18n';

export type ProfileRole = 'chef_de_projet' | 'collaborateur';

export type Profile = {
  firstName: string;
  lastName: string;
  username: string;
  /** Mention déclarée par la personne, non vérifiée. Absent : non précisé. */
  role?: ProfileRole;
};

/** « Chef de projet », dans la langue de l'app. */
export function roleLabel(role: ProfileRole): string {
  return getT().roles[role];
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Sans accents, en minuscules, seulement lettres, chiffres, point, tiret et tiret bas. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’\s]+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[-._]{2,}/g, (run) => run[0])
    .replace(/^[-._]+|[-._]+$/g, '');
}

/** Identifiant proposé d'après le prénom et le nom : « Julie Martin » → « julie.martin ». */
export function suggestUsername(firstName: string, lastName: string): string {
  const parts = [slug(firstName), slug(lastName)].filter(Boolean);
  return parts
    .join('.')
    .slice(0, USERNAME_MAX)
    .replace(/[-._]+$/, '');
}

/** Variante proposée quand l'identifiant est déjà pris : « julie.martin2 », « julie.martin3 »… */
export function nextUsername(username: string): string {
  const match = username.match(/^(.*?)(\d+)$/);
  const base = match ? match[1] : username;
  const number = match ? Number(match[2]) + 1 : 2;
  const suffix = String(number);
  return `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
}

/** Le problème de l'identifiant, à afficher, ou null s'il est valable. */
export function usernameProblem(username: string): string | null {
  const t = getT().profileForm;
  if (username.length < USERNAME_MIN) return t.usernameMin(USERNAME_MIN);
  if (username.length > USERNAME_MAX) return t.usernameMax(USERNAME_MAX);
  if (!USERNAME.test(username)) return t.usernameChars;
  return null;
}

/** Le problème du profil (premier trouvé), ou null s'il peut être enregistré. */
export function profileProblem(profile: Profile): string | null {
  const t = getT().profileForm;
  if (!profile.firstName.trim()) return t.firstNameRequired;
  if (!profile.lastName.trim()) return t.lastNameRequired;
  if (profile.firstName.trim().length > 60 || profile.lastName.trim().length > 60) return t.namesTooLong;
  return usernameProblem(profile.username);
}

/** « Julie Martin ». */
export function displayName(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim();
}
