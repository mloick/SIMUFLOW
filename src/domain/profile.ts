/**
 * Profil d'un compte : prénom, nom, identifiant unique (« julie.martin ») et
 * rôle déclaré. L'identifiant servira à inviter quelqu'un sur un process.
 * Fonctions pures, testées dans __tests__/profile.test.ts.
 */

export type ProfileRole = 'chef_de_projet' | 'collaborateur';

export type Profile = {
  firstName: string;
  lastName: string;
  username: string;
  /** Mention déclarée par la personne, non vérifiée. Absent : non précisé. */
  role?: ProfileRole;
};

export const ROLE_LABELS: Record<ProfileRole, string> = {
  chef_de_projet: 'Chef de projet',
  collaborateur: 'Collaborateur',
};

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
  if (username.length < USERNAME_MIN) return `Au moins ${USERNAME_MIN} caractères.`;
  if (username.length > USERNAME_MAX) return `Au plus ${USERNAME_MAX} caractères.`;
  if (!USERNAME.test(username))
    return 'Minuscules sans accent, chiffres, point, tiret ou tiret bas ; commence par une lettre ou un chiffre.';
  return null;
}

/** Le problème du profil (premier trouvé), ou null s'il peut être enregistré. */
export function profileProblem(profile: Profile): string | null {
  if (!profile.firstName.trim()) return 'Le prénom est obligatoire.';
  if (!profile.lastName.trim()) return 'Le nom est obligatoire.';
  if (profile.firstName.trim().length > 60 || profile.lastName.trim().length > 60)
    return 'Le prénom et le nom font au plus 60 caractères.';
  return usernameProblem(profile.username);
}

/** « Julie Martin ». */
export function displayName(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim();
}
