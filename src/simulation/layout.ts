/**
 * Mise en page du schéma d'un process, pour le dessiner pendant la simulation.
 *
 * - Un process importé de draw.io garde la position de ses formes.
 * - Sinon (JSON, tableau scanné), la mise en page est calculée : une colonne
 *   par acteur (comme les couloirs d'un schéma) et une ligne par niveau, le
 *   niveau d'une étape étant la longueur du plus long chemin qui y mène.
 */

import { buildGraph, type Process, type StepKind } from '@/domain';

export type Point = { x: number; y: number };

export type DiagramNode = {
  id: string;
  kind: StepKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DiagramEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  points: Point[];
};

export type DiagramLane = { label: string; x: number; width: number };

export type DiagramLayout = {
  nodes: Map<string, DiagramNode>;
  edges: DiagramEdge[];
  /** Couloirs (mise en page calculée seulement). */
  lanes: DiagramLane[];
  width: number;
  height: number;
  /** « drawio » si les positions viennent du fichier, « auto » sinon. */
  source: 'drawio' | 'auto';
};

export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 56;
const COLUMN_GAP = 24;
const ROW_HEIGHT = 104;
const LANE_HEADER = 36;
const MARGIN = 24;
/** Écart des flèches qui remontent (boucles), sur le côté droit des étapes. */
const RETURN_OFFSET = 18;

export function layoutProcess(process: Process): DiagramLayout {
  const fromFile = process.steps.length > 0 && process.steps.every((step) => step.layout);
  const placed = fromFile ? placeFromFile(process) : placeAutomatically(process);
  return {
    ...placed,
    edges: routeEdges(process, placed.nodes, !fromFile),
    source: fromFile ? 'drawio' : 'auto',
  };
}

type Placement = Omit<DiagramLayout, 'edges' | 'source'>;

function placeFromFile(process: Process): Placement {
  const minX = Math.min(...process.steps.map((step) => step.layout!.x));
  const minY = Math.min(...process.steps.map((step) => step.layout!.y));
  const nodes = new Map<string, DiagramNode>();
  let width = 0;
  let height = 0;
  for (const step of process.steps) {
    const box = step.layout!;
    const node: DiagramNode = {
      id: step.id,
      kind: step.kind,
      title: step.title,
      x: box.x - minX + MARGIN,
      y: box.y - minY + MARGIN,
      width: Math.max(box.width, 40),
      height: Math.max(box.height, 32),
    };
    nodes.set(step.id, node);
    width = Math.max(width, node.x + node.width + MARGIN + RETURN_OFFSET * 2);
    height = Math.max(height, node.y + node.height + MARGIN);
  }
  return { nodes, lanes: [], width, height };
}

/** Niveau de chaque étape : plus long chemin depuis un départ, sans compter les retours en arrière. */
export function computeRanks(process: Process): Map<string, number> {
  const graph = buildGraph(process);
  const rank = new Map<string, number>();
  const state = new Map<string, 'open' | 'done'>();
  const order: string[] = [];
  const backLinks = new Set<string>();

  // Parcours en profondeur : une flèche vers une étape « ouverte » est un
  // retour en arrière (boucle) et ne compte pas pour les niveaux.
  const visit = (id: string) => {
    state.set(id, 'open');
    for (const link of graph.outgoing.get(id) ?? []) {
      const next = state.get(link.to);
      if (next === 'open') backLinks.add(link.id);
      else if (!next) visit(link.to);
    }
    state.set(id, 'done');
    order.push(id);
  };
  for (const start of graph.starts) if (!state.has(start.id)) visit(start.id);
  for (const step of process.steps) if (!state.has(step.id)) visit(step.id);

  for (const id of order.reverse()) {
    const incoming = (graph.incoming.get(id) ?? []).filter((link) => !backLinks.has(link.id));
    rank.set(
      id,
      incoming.reduce((max, link) => Math.max(max, (rank.get(link.from) ?? 0) + 1), 0),
    );
  }
  return rank;
}

function placeAutomatically(process: Process): Placement {
  const ranks = computeRanks(process);
  const ordered = [...process.steps].sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!);

  // Couloirs dans l'ordre où les acteurs apparaissent.
  const laneNames: string[] = [];
  for (const step of ordered) {
    const name = step.actor ?? '';
    if (!laneNames.includes(name)) laneNames.push(name);
  }
  const showLanes = laneNames.some(Boolean);

  // Nombre de colonnes de chaque couloir : le plus grand nombre d'étapes d'un même niveau.
  const cells = new Map<string, number>();
  const slot = new Map<string, number>();
  for (const step of ordered) {
    const key = `${step.actor ?? ''}|${ranks.get(step.id)}`;
    slot.set(step.id, cells.get(key) ?? 0);
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  const columns = laneNames.map((name) =>
    Math.max(1, ...[...cells].filter(([key]) => key.startsWith(`${name}|`)).map(([, count]) => count)),
  );

  const lanes: DiagramLane[] = [];
  let x = MARGIN;
  laneNames.forEach((name, index) => {
    const width = columns[index] * NODE_WIDTH + (columns[index] - 1) * COLUMN_GAP + COLUMN_GAP;
    lanes.push({ label: name, x, width });
    x += width;
  });

  const top = MARGIN + (showLanes ? LANE_HEADER : 0);
  const nodes = new Map<string, DiagramNode>();
  let maxRank = 0;
  for (const step of process.steps) {
    const lane = lanes[laneNames.indexOf(step.actor ?? '')];
    const rank = ranks.get(step.id)!;
    maxRank = Math.max(maxRank, rank);
    nodes.set(step.id, {
      id: step.id,
      kind: step.kind,
      title: step.title,
      x: lane.x + COLUMN_GAP / 2 + slot.get(step.id)! * (NODE_WIDTH + COLUMN_GAP),
      y: top + rank * ROW_HEIGHT,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  return {
    nodes,
    lanes: showLanes ? lanes : [],
    width: x + MARGIN + RETURN_OFFSET * 2,
    height: top + maxRank * ROW_HEIGHT + NODE_HEIGHT + MARGIN,
  };
}

const center = (node: DiagramNode): Point => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

/** Point du bord de la forme dans la direction d'un autre point. */
export function borderPoint(node: DiagramNode, toward: Point): Point {
  const c = center(node);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  // Losange : |dx|/halfW + |dy|/halfH = 1 ; rectangle : max(|dx|/halfW, |dy|/halfH) = 1.
  const scale =
    node.kind === 'decision'
      ? 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH)
      : 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

function routeEdges(process: Process, nodes: Map<string, DiagramNode>, orthogonal: boolean): DiagramEdge[] {
  const edges: DiagramEdge[] = [];
  for (const link of process.links) {
    const from = nodes.get(link.from);
    const to = nodes.get(link.to);
    if (!from || !to) continue;
    let points: Point[];
    if (from.id === to.id || to.y + to.height <= from.y) {
      // Retour en arrière : la flèche sort à droite, remonte, et rentre à droite.
      const side = Math.max(from.x + from.width, to.x + to.width) + RETURN_OFFSET;
      const a = { x: from.x + from.width, y: from.y + from.height / 2 };
      const b = { x: to.x + to.width, y: to.y + to.height / 2 };
      points = [a, { x: side, y: a.y }, { x: side, y: b.y }, b];
    } else if (orthogonal) {
      // Vers le bas. Si l'étape d'arrivée est bien à gauche ou à droite, la
      // flèche sort par le côté, puis descend : les sorties d'une décision
      // ne se superposent pas. Sinon, elle sort par le bas.
      const fromCenter = center(from);
      const b = { x: to.x + to.width / 2, y: to.y };
      if (Math.abs(b.x - fromCenter.x) > from.width / 2) {
        const side = b.x > fromCenter.x ? from.x + from.width : from.x;
        points = [{ x: side, y: fromCenter.y }, { x: b.x, y: fromCenter.y }, b];
      } else {
        const a = { x: fromCenter.x, y: from.y + from.height };
        points =
          Math.abs(a.x - b.x) < 1
            ? [a, { x: a.x, y: b.y }]
            : [a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b];
      }
    } else {
      points = [borderPoint(from, center(to)), borderPoint(to, center(from))];
    }
    edges.push({
      id: link.id,
      from: link.from,
      to: link.to,
      label: link.label,
      points,
    });
  }
  return edges;
}

/** Milieu d'une ligne brisée, pour y poser le libellé d'une flèche. */
export function midpoint(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let rest = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (rest <= lengths[i] && lengths[i] > 0) {
      const t = rest / lengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    rest -= lengths[i];
  }
  return points[0];
}

/**
 * Ligne brisée décalée de `distance` sur sa gauche (dans le sens de la
 * marche), pour poser côte à côte les traits de plusieurs familles.
 */
export function offsetPolyline(points: Point[], distance: number): Point[] {
  if (distance === 0 || points.length < 2) return points;
  const normals = points.slice(1).map((p, i) => {
    const dx = p.x - points[i].x;
    const dy = p.y - points[i].y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dy / length, y: -dx / length };
  });
  return points.map((p, i) => {
    const before = normals[Math.max(0, i - 1)];
    const after = normals[Math.min(normals.length - 1, i)];
    // Au coin, on prolonge les deux côtés jusqu'à ce qu'ils se rejoignent.
    const join = 1 + before.x * after.x + before.y * after.y;
    const scale = join < 0.1 ? 1 : 1 / join;
    return { x: p.x + (before.x + after.x) * distance * scale, y: p.y + (before.y + after.y) * distance * scale };
  });
}

/** Texte coupé en lignes de `perLine` caractères au plus, avec « … » au-delà de `maxLines`. */
export function wrap(text: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= perLine) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, Math.max(1, perLine - 1)) + '…';
    return kept;
  }
  return lines;
}
