/**
 * Schémas draw.io fictifs dessinés de façons très différentes, pour vérifier
 * que la lecture ne dépend ni des formes ni des couleurs.
 */

type Forme = { id: string; texte: string; style?: string; x: number; y: number };
type Fleche = [from: string, to: string, label?: string];

const esc = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&lt;br&gt;');

/** Construit un modèle draw.io à partir de formes et de flèches. */
export function modele(formes: Forme[], fleches: Fleche[]): string {
  const cells = formes.map(
    (f) =>
      `<mxCell id="${f.id}" value="${esc(f.texte)}" style="${f.style ?? 'rounded=0;whiteSpace=wrap;html=1;'}" vertex="1" parent="1">` +
      `<mxGeometry x="${f.x}" y="${f.y}" width="140" height="70" as="geometry"/></mxCell>`,
  );
  const edges = fleches.map(
    ([from, to, label], i) =>
      `<mxCell id="e${i}" value="${esc(label ?? '')}" edge="1" parent="1" source="${from}" target="${to}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
  );
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}${edges.join('')}</root></mxGraphModel>`;
}

/**
 * Validation d'une facture : que des rectangles, aucune couleur, aucun losange,
 * ni « Début » ni « Fin ». Les acteurs sont écrits dans le texte.
 */
export const SANS_FORME = modele(
  [
    { id: 'recevoir', texte: 'Recevoir la facture\nResponsable : Comptabilité', x: 0, y: 0 },
    { id: 'montant', texte: 'Montant supérieur à 500 € ?', x: 200, y: 0 },
    { id: 'payer', texte: 'Payer\nResponsable : comptabilité\n2 jours', x: 400, y: 0 },
    { id: 'viser', texte: 'Faire viser\nResponsable :\nDirection financière', x: 400, y: 120 },
    { id: 'archiver', texte: 'Archiver la facture', x: 600, y: 0 },
  ],
  [
    ['recevoir', 'montant'],
    ['montant', 'payer', 'non'],
    ['montant', 'viser', 'oui'],
    ['viser', 'payer'],
    ['payer', 'archiver'],
  ],
);

/** Prêt de matériel : que des cercles ; la décision n'a pas de « ? » mais deux sorties nommées. */
export const QUE_DES_CERCLES = modele(
  [
    { id: 'demande', texte: 'Demande de prêt', style: 'ellipse;', x: 0, y: 0 },
    { id: 'dispo', texte: 'Vérifier le stock', style: 'ellipse;', x: 200, y: 0 },
    { id: 'preter', texte: 'Prêter', style: 'ellipse;', x: 400, y: 0 },
    { id: 'attendre', texte: 'Mettre en attente', style: 'ellipse;', x: 400, y: 120 },
  ],
  [
    ['demande', 'dispo'],
    ['dispo', 'preter', 'disponible'],
    ['dispo', 'attendre', 'rupture'],
  ],
);

/** Ticket d'assistance : des personnes et des équipes écrites de plusieurs façons. */
export const ACTEURS_DANS_LE_TEXTE = modele(
  [
    { id: 'ouvrir', texte: 'Ticket créé\nAssignee : Camille / Sam (service Support)', x: 0, y: 0 },
    { id: 'analyser', texte: 'Analyser\nAssignment group :\nÉquipe Réseau (Alex / Lou)', x: 200, y: 0 },
    { id: 'clore', texte: 'Ticket clos\nAssignee : service support', x: 400, y: 0 },
  ],
  [
    ['ouvrir', 'analyser'],
    ['analyser', 'clore'],
  ],
);
