/**
 * Schéma d'un process en image SVG (texte), pour le PDF. Même dessin que dans
 * l'app (couloirs, formes, flèches à angle droit), en couleurs d'impression.
 */

import type { StepKind } from '@/domain';
import type { FamilyStroke } from '@/simulation/families';
import { midpoint, offsetPolyline, wrap, type DiagramLayout, type Point } from '@/simulation/layout';

/** Couleurs claires de l'app (src/constants/theme.ts), pour une page blanche. */
const INK = {
  text: '#0b2540',
  muted: '#4a5b70',
  lane: '#eef3f8',
  border: '#c3d0de',
  primary: '#0078bd',
  primaryBackground: '#e1f0fa',
  warning: '#9a4510',
  warningBackground: '#fdeedf',
};

const FAMILY_GAP = 4.5;
const FONT = 'Inter, -apple-system, Helvetica, Arial, sans-serif';

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const path = (points: Point[]) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(' ');

const arrowId = (color: string) => `a${color.replace(/[^a-zA-Z0-9]/g, '')}`;

function nodeColors(kind: StepKind) {
  if (kind === 'decision') return { fill: INK.warningBackground, stroke: INK.warning, text: INK.warning };
  if (kind === 'start' || kind === 'end') return { fill: INK.text, stroke: INK.text, text: '#ffffff' };
  return { fill: '#ffffff', stroke: INK.border, text: INK.text };
}

/**
 * Tout le schéma. Avec `strokes`, chaque flèche a un trait par famille de
 * chemins, côte à côte ; sinon les flèches sont bleues.
 */
export function diagramSvg(layout: DiagramLayout, strokes?: Map<string, FamilyStroke[]>): string {
  const parts: string[] = [];
  const colors = new Set([INK.primary, INK.muted]);
  strokes?.forEach((list) => list.forEach((item) => colors.add(item.color)));

  parts.push(
    '<defs>' +
      [...colors]
        .map(
          (color) =>
            `<marker id="${arrowId(color)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`,
        )
        .join('') +
      '</defs>',
  );

  layout.lanes.forEach((lane, index) => {
    parts.push(
      `<rect x="${lane.x}" y="8" width="${lane.width}" height="${layout.height - 16}" rx="10" fill="${index % 2 ? '#ffffff' : INK.lane}"/>`,
      `<text x="${lane.x + 10}" y="30" font-size="13" font-weight="600" fill="${INK.muted}">${escape(lane.label || 'Sans acteur')}</text>`,
    );
  });

  for (const edge of layout.edges) {
    const list = strokes ? (strokes.get(edge.id) ?? []) : [{ color: INK.primary, bold: false }];
    if (list.length === 0) {
      parts.push(
        `<path d="${path(edge.points)}" fill="none" stroke="${INK.muted}" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.6" marker-end="url(#${arrowId(INK.muted)})"/>`,
      );
    }
    list.forEach((item, index) => {
      const points = offsetPolyline(edge.points, (index - (list.length - 1) / 2) * FAMILY_GAP);
      parts.push(
        `<path d="${path(points)}" fill="none" stroke="${item.color}" stroke-width="${item.bold ? 4 : 2.5}" marker-end="url(#${arrowId(item.color)})"/>`,
      );
    });
    if (edge.label) {
      const mid = midpoint(edge.points);
      const color = list.length === 1 ? list[0].color : INK.muted;
      const width = Math.max(22, edge.label.length * 6.6 + 12);
      parts.push(
        `<rect x="${mid.x - width / 2}" y="${mid.y - 9}" width="${width}" height="18" rx="9" fill="#ffffff" stroke="${color}"/>`,
        `<text x="${mid.x}" y="${mid.y + 4}" font-size="12" font-weight="600" fill="${color}" text-anchor="middle">${escape(edge.label)}</text>`,
      );
    }
  }

  for (const node of layout.nodes.values()) {
    const { fill, stroke, text } = nodeColors(node.kind);
    const { x, y, width: w, height: h } = node;
    parts.push(
      node.kind === 'decision'
        ? `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${node.kind === 'task' ? 10 : h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
    );
    const fontSize = 13;
    const usable = node.kind === 'decision' ? w * 0.62 : w - 14;
    const lines = wrap(node.title || 'Sans titre', Math.max(6, Math.floor(usable / (fontSize * 0.56))), 3);
    const lineHeight = fontSize * 1.2;
    const firstY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
    parts.push(
      `<text font-size="${fontSize}" font-weight="600" fill="${text}" text-anchor="middle">` +
        lines
          .map((line, i) => `<tspan x="${x + w / 2}" y="${firstY + i * lineHeight}">${escape(line)}</tspan>`)
          .join('') +
        '</text>',
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" ` +
    `width="${layout.width}" height="${layout.height}" font-family="${FONT}">${parts.join('')}</svg>`
  );
}
