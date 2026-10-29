/**
 * Export d'un process en fichier draw.io (.drawio), à rouvrir et retoucher
 * dans draw.io, ou à réimporter dans SimuFlow.
 *
 * Le fichier reprend la mise en page du schéma de l'app : un couloir par
 * acteur (mise en page calculée) ou les positions d'origine (process importé de
 * draw.io). Chaque étape garde son délai dans son texte (« 2 JO ») et son
 * acteur dans une propriété « acteur », lue aussi par l'import quand il n'y a
 * pas de couloir.
 */

import type { Process, StepKind } from '@/domain';
import type { FamilyStroke } from '@/simulation/families';
import { formatNumber } from '@/utils/format';
import type { DiagramLayout } from '@/simulation/layout';

export type DrawioOptions = {
  /** Couleur des flèches par famille de chemins (vue « Tous »). */
  strokes?: Map<string, FamilyStroke[]>;
};

/** Gris des flèches partagées par plusieurs familles, ou empruntées par aucune. */
const SHARED_STROKE = '#4a5b70';

const STYLES: Record<StepKind, string> = {
  start: 'ellipse;whiteSpace=wrap;html=1;fillColor=#0b2540;strokeColor=#0b2540;fontColor=#ffffff;fontStyle=1;',
  end: 'ellipse;whiteSpace=wrap;html=1;fillColor=#0b2540;strokeColor=#0b2540;fontColor=#ffffff;fontStyle=1;',
  task: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e1f0fa;strokeColor=#0078bd;fontColor=#0b2540;',
  decision: 'rhombus;whiteSpace=wrap;html=1;fillColor=#fdeedf;strokeColor=#9a4510;fontColor=#9a4510;fontStyle=1;',
};

const LANE_STYLE =
  'swimlane;startSize=30;html=1;whiteSpace=wrap;fillColor=#eef3f8;strokeColor=#dde5ee;fontColor=#4a5b70;fontStyle=1;';

/** Échappe un texte pour un attribut XML. */
function attr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}

/** Les libellés sont en HTML (html=1) : on échappe aussi le texte lui-même. */
const html = (text: string) => attr(attr(text));

const round = (value: number) => Math.round(value * 10) / 10;

export function processToDrawio(process: Process, layout: DiagramLayout, options: DrawioOptions = {}): string {
  const cells: string[] = ['<mxCell id="0" />', '<mxCell id="1" parent="0" />'];

  // Couloirs : les étapes y sont rangées, en coordonnées relatives au couloir.
  const laneOf = new Map<string, { id: string; x: number; y: number }>();
  const laneTop = 8;
  layout.lanes.forEach((lane, index) => {
    const id = `couloir-${index + 1}`;
    cells.push(
      `<mxCell id="${id}" value="${html(lane.label)}" style="${LANE_STYLE}" vertex="1" parent="1">` +
        `<mxGeometry x="${round(lane.x)}" y="${laneTop}" width="${round(lane.width)}" height="${round(layout.height - laneTop * 2)}" as="geometry" /></mxCell>`,
    );
    laneOf.set(lane.label, { id, x: lane.x, y: laneTop });
  });

  for (const step of process.steps) {
    const node = layout.nodes.get(step.id);
    if (!node) continue;
    const lane = layout.lanes.length ? laneOf.get(step.actor ?? '') : undefined;
    const parent = lane?.id ?? '1';
    const x = node.x - (lane?.x ?? 0);
    const y = node.y - (lane?.y ?? 0);
    const duration = step.duration ? `${formatNumber(step.duration)} JO` : '';
    const text = attr(step.title) + (duration ? `<br>${duration}` : '');
    const cell =
      `<mxCell style="${STYLES[step.kind]}" vertex="1" parent="${parent}">` +
      `<mxGeometry x="${round(x)}" y="${round(y)}" width="${round(node.width)}" height="${round(node.height)}" as="geometry" /></mxCell>`;
    cells.push(
      `<object id="${attr(`etape-${step.id}`)}" label="${attr(text)}"${step.actor ? ` acteur="${attr(step.actor)}"` : ''}>${cell}</object>`,
    );
  }

  for (const link of process.links) {
    const edge = layout.edges.find((item) => item.id === link.id);
    const strokes = options.strokes?.get(link.id) ?? [];
    const color = strokes.length === 1 ? strokes[0].color : SHARED_STROKE;
    const width = strokes.some((item) => item.bold) ? 4 : 2;
    const dashed = options.strokes && strokes.length === 0 ? 'dashed=1;' : '';
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;strokeColor=${color};strokeWidth=${width};fontColor=${color};${dashed}`;
    // Les coins de la flèche dessinée dans l'app servent de points de passage.
    const waypoints = (edge?.points ?? []).slice(1, -1);
    const geometry = waypoints.length
      ? `<mxGeometry relative="1" as="geometry"><Array as="points">${waypoints
          .map((p) => `<mxPoint x="${round(p.x)}" y="${round(p.y)}" />`)
          .join('')}</Array></mxGeometry>`
      : '<mxGeometry relative="1" as="geometry" />';
    cells.push(
      `<mxCell id="${attr(`lien-${link.id}`)}" value="${html(link.label ?? '')}" style="${style}" edge="1" parent="1" ` +
        `source="${attr(`etape-${link.from}`)}" target="${attr(`etape-${link.to}`)}">${geometry}</mxCell>`,
    );
  }

  const page =
    `<mxGraphModel dx="${round(layout.width)}" dy="${round(layout.height)}" grid="1" gridSize="10" guides="1" ` +
    `page="1" pageWidth="${Math.ceil(layout.width)}" pageHeight="${Math.ceil(layout.height)}"><root>\n${cells.join('\n')}\n</root></mxGraphModel>`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<mxfile host="SimuFlow" type="device"><diagram id="simuflow" name="${attr(process.name)}">${page}</diagram></mxfile>\n`
  );
}
