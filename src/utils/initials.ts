/**
 * Les initiales d'un nom ou d'une adresse, pour l'avatar :
 * « Camille Martin » → « CM » ; « camille.martin@exemple.fr » → « CM » ; « camille » → « CA ».
 */
export function initials(text = ''): string {
  const parts = text
    .split('@')[0]
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : text.slice(0, 2)).toUpperCase();
}
