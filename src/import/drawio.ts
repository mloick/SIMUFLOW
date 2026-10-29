/**
 * Lecture d'un fichier draw.io (.drawio ou .xml), reprise du prototype web.
 *
 * Un fichier draw.io est du XML : <mxfile> contient une <diagram> par page.
 * Chaque page contient un <mxGraphModel>, soit en clair, soit compressé
 * (base64 d'un flux « deflate » du XML encodé en URL). Dans le modèle, chaque
 * <mxCell> est une forme (vertex="1") ou une flèche (edge="1").
 *
 * On en tire un Process par page :
 * - les couloirs (swimlanes) donnent l'acteur des étapes qu'ils contiennent ;
 * - les zones de texte non reliées sont des notes, ignorées ;
 * - un losange est une décision ; un départ et une fin se reconnaissent à leur
 *   forme (ellipse) ou à leur texte (« Début », « Fin », « Clôturé »…) ;
 * - une flèche dont un bout n'est pas accroché est rattachée à l'étape la plus
 *   proche, avec une remarque.
 */

import { DOMParser, type Element } from '@xmldom/xmldom';
import { inflateSync, strFromU8 } from 'fflate';

import type { Link, Process, Step, StepKind } from '@/domain';

import { ImportError, type ImportResult } from './errors';
import { cellText, durationOf } from './text';

type Style = Record<string, string>;

type Cell = {
  id: string;
  parent: string | null;
  text: string;
  style: string;
  st: Style;
  vertex: boolean;
  edge: boolean;
  source: string | null;
  target: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  sourcePoint?: Point;
  targetPoint?: Point;
  points: Point[];
  // Position absolue (une forme dans un groupe ou un couloir a des
  // coordonnées relatives à son parent).
  ax: number;
  ay: number;
  ox: number;
  oy: number;
};

type Point = { x: number; y: number };

const START_TEXT = /^(start|début|debut|démarrage|demarrage|begin|départ|depart)\b/i;
const END_TEXT = /cl[oô]tur|\bclos(e|es|ed|ure)?(?![A-Za-zÀ-ÿ])|termin[ée]|\bfin\b|\bend\b|\bdone\b/i;

function parseStyle(style: string): Style {
  const result: Style = {};
  for (const part of style.split(';')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) result[part] = '1';
    else result[part.slice(0, i)] = part.slice(i + 1);
  }
  return result;
}

function parseXml(text: string) {
  try {
    return new DOMParser({ onError: () => {} }).parseFromString(text, 'text/xml');
  } catch {
    throw new ImportError('Ce fichier n’est pas un schéma draw.io lisible.');
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Décompresse une page draw.io : base64 → deflate brut → texte encodé en URL. */
export function inflateDiagram(compressed: string): string {
  return decodeURIComponent(strFromU8(inflateSync(base64ToBytes(compressed))));
}

function firstChild(element: Element, name: string): Element | undefined {
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i] as Element;
    if (child.nodeName === name) return child;
  }
  return undefined;
}

function readCells(model: Element): Cell[] {
  const cells: Cell[] = [];
  const list = model.getElementsByTagName('mxCell');
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    // Une forme avec des propriétés est enveloppée dans <object> ou <UserObject>,
    // qui porte alors l'identifiant et le libellé.
    const wrapper = el.parentNode && /^(object|UserObject)$/i.test(el.parentNode.nodeName) ? (el.parentNode as Element) : null;
    const id = (wrapper ?? el).getAttribute('id');
    const vertex = el.getAttribute('vertex') === '1';
    const edge = el.getAttribute('edge') === '1';
    if (!id || (!vertex && !edge)) continue;

    const value = wrapper ? (wrapper.getAttribute('label') ?? wrapper.getAttribute('value') ?? '') : (el.getAttribute('value') ?? '');
    const style = el.getAttribute('style') ?? '';
    const cell: Cell = {
      id,
      parent: el.getAttribute('parent'),
      text: cellText(value),
      style,
      st: parseStyle(style),
      vertex,
      edge,
      source: el.getAttribute('source'),
      target: el.getAttribute('target'),
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      points: [],
      ax: 0,
      ay: 0,
      ox: 0,
      oy: 0,
    };

    const geometry = firstChild(el, 'mxGeometry');
    if (geometry) {
      cell.x = Number(geometry.getAttribute('x')) || 0;
      cell.y = Number(geometry.getAttribute('y')) || 0;
      cell.w = Number(geometry.getAttribute('width')) || 0;
      cell.h = Number(geometry.getAttribute('height')) || 0;
      const points = geometry.getElementsByTagName('mxPoint');
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const point = { x: Number(p.getAttribute('x')) || 0, y: Number(p.getAttribute('y')) || 0 };
        const as = p.getAttribute('as');
        if (as === 'sourcePoint') cell.sourcePoint = point;
        else if (as === 'targetPoint') cell.targetPoint = point;
        else if (as !== 'offset') cell.points.push(point);
      }
    }
    cells.push(cell);
  }
  return cells;
}

function buildPage(model: Element, pageName: string, id: string, name: string, warnings: string[]): Process | null {
  const cells = readCells(model);
  const byId = new Map(cells.map((cell) => [cell.id, cell]));

  // Coordonnées absolues : on ajoute celles des parents (groupes, couloirs).
  const done = new Set<string>();
  const absolute = (cell: Cell) => {
    if (done.has(cell.id)) return;
    done.add(cell.id);
    const parent = cell.parent ? byId.get(cell.parent) : undefined;
    if (parent && parent.vertex && !parent.edge) {
      absolute(parent);
      cell.ox = parent.ax;
      cell.oy = parent.ay;
    }
    cell.ax = cell.x + cell.ox;
    cell.ay = cell.y + cell.oy;
  };
  cells.forEach(absolute);

  // Les libellés de flèche sont des formes dont le parent est la flèche.
  const edgeLabels = new Map<string, string>();
  for (const cell of cells) {
    const parent = cell.parent ? byId.get(cell.parent) : undefined;
    if (cell.vertex && parent?.edge && cell.text) edgeLabels.set(parent.id, cell.text);
  }

  const shapes = cells.filter((cell) => {
    const parent = cell.parent ? byId.get(cell.parent) : undefined;
    return cell.vertex && !parent?.edge && cell.w > 0 && cell.h > 0;
  });
  const edgesCells = cells.filter((cell) => cell.edge);
  const attached = new Set<string>();
  for (const edge of edgesCells) {
    if (edge.source) attached.add(edge.source);
    if (edge.target) attached.add(edge.target);
  }

  const inside = (a: Cell, b: Cell) =>
    a !== b && a.ax >= b.ax - 2 && a.ay >= b.ay - 2 && a.ax + a.w <= b.ax + b.w + 2 && a.ay + a.h <= b.ay + b.h + 2;

  const lanes: Cell[] = [];
  let nodes: Cell[] = [];
  for (const cell of shapes) {
    const st = cell.st;
    const contains = shapes.filter((other) => inside(other, cell)).length;
    const big = cell.w >= 140 && cell.h >= 90;
    const isLane =
      !st.rhombus &&
      (st.swimlane !== undefined ||
        st.pool !== undefined ||
        /lane|pool/.test(cell.style) ||
        st.container === '1' ||
        (big && contains >= 2 && !attached.has(cell.id) && (!cell.text || st.verticalAlign === 'top' || st.fillColor === 'none')));
    if (isLane) {
      lanes.push(cell);
      continue;
    }
    const textOnly =
      st.text !== undefined || st.shape === 'text' || (st.strokeColor === 'none' && (st.fillColor === 'none' || !st.fillColor) && !st.rhombus);
    if (textOnly && !attached.has(cell.id)) continue; // note
    nodes.push(cell);
  }

  const center = (cell: Cell) => ({ x: cell.ax + cell.w / 2, y: cell.ay + cell.h / 2 });
  const actorOf = (cell: Cell) => {
    const { x, y } = center(cell);
    let best: Cell | undefined;
    for (const lane of lanes) {
      if (x >= lane.ax && x <= lane.ax + lane.w && y >= lane.ay && y <= lane.ay + lane.h && (!best || lane.w * lane.h < best.w * best.h)) {
        best = lane;
      }
    }
    return best?.text.split('\n')[0] || undefined;
  };

  const nodeIds = new Set(nodes.map((node) => node.id));
  const nearest = (point: Point | undefined) => {
    if (!point) return undefined;
    let best: Cell | undefined;
    for (const node of nodes) {
      const margin = 14;
      if (
        point.x >= node.ax - margin &&
        point.x <= node.ax + node.w + margin &&
        point.y >= node.ay - margin &&
        point.y <= node.ay + node.h + margin &&
        (!best || node.w * node.h < best.w * best.h)
      ) {
        best = node;
      }
    }
    return best;
  };

  let fixedCount = 0;
  const rawLinks: { id: string; from?: string; to?: string; label: string }[] = [];
  for (const edge of edgesCells) {
    const offset = (p?: Point) => (p ? { x: p.x + edge.ox, y: p.y + edge.oy } : undefined);
    let from = edge.source && nodeIds.has(edge.source) ? edge.source : undefined;
    let to = edge.target && nodeIds.has(edge.target) ? edge.target : undefined;
    let fixed = false;
    if (!from) {
      const node = nearest(offset(edge.sourcePoint ?? edge.points[0]));
      if (node) [from, fixed] = [node.id, true];
    }
    if (!to) {
      const node = nearest(offset(edge.targetPoint ?? edge.points[edge.points.length - 1]));
      if (node) [to, fixed] = [node.id, true];
    }
    // Flèche dessinée à l'envers : la pointe est au départ.
    if (edge.st.endArrow === 'none' && edge.st.startArrow && edge.st.startArrow !== 'none') [from, to] = [to, from];
    if (fixed && from && to) fixedCount++;
    rawLinks.push({ id: edge.id, from, to, label: (edge.text || edgeLabels.get(edge.id) || '').replace(/\n/g, ' ') });
  }

  // Une forme reliée à rien est une annotation (légende, titre) : ignorée.
  const linked = new Set<string>();
  for (const link of rawLinks) {
    if (link.from) linked.add(link.from);
    if (link.to) linked.add(link.to);
  }
  const ignored = nodes.filter((node) => !linked.has(node.id)).length;
  nodes = nodes.filter((node) => linked.has(node.id));
  if (nodes.length === 0) return null;

  // Ordre de lecture : de haut en bas, puis de gauche à droite.
  nodes.sort((a, b) => center(a).y - center(b).y || center(a).x - center(b).x);
  const rank = new Map(nodes.map((node, index) => [node.id, index]));

  const links: Link[] = rawLinks
    .filter((link) => link.from || link.to)
    .map((link) => ({ id: link.id, from: link.from ?? '?', to: link.to ?? '?', label: link.label || undefined }))
    .sort((a, b) => (rank.get(a.from) ?? 1e9) - (rank.get(b.from) ?? 1e9) || (rank.get(a.to) ?? 1e9) - (rank.get(b.to) ?? 1e9));

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const link of links) {
    outgoing.set(link.from, (outgoing.get(link.from) ?? 0) + 1);
    incoming.set(link.to, (incoming.get(link.to) ?? 0) + 1);
  }

  const steps: Step[] = nodes.map((node) => {
    const ins = incoming.get(node.id) ?? 0;
    const outs = outgoing.get(node.id) ?? 0;
    const title = node.text.split('\n')[0] ?? '';
    const ellipse = node.st.ellipse !== undefined || /terminator|startState|endState|flowchart\.start/.test(node.style);
    let kind: StepKind = 'task';
    if (node.st.rhombus !== undefined || /decision/.test(node.style)) kind = 'decision';
    else if (ellipse && ins === 0 && outs > 0) kind = 'start';
    else if (ellipse && outs === 0 && ins > 0) kind = 'end';
    else if (ins === 0 && outs > 0 && START_TEXT.test(node.text)) kind = 'start';
    else if (outs === 0 && ins > 0 && END_TEXT.test(title)) kind = 'end';

    const step: Step = { id: node.id, kind, title, layout: { x: node.ax, y: node.ay, width: node.w, height: node.h } };
    const actor = actorOf(node);
    const duration = durationOf(node.text);
    if (actor) step.actor = actor;
    if (duration !== undefined) step.duration = duration;
    return step;
  });

  if (fixedCount) warnings.push(`${pageName} : ${fixedCount} flèche(s) rattachée(s) à l’étape la plus proche, à relier dans draw.io.`);
  if (ignored) warnings.push(`${pageName} : ${ignored} forme(s) sans flèche ignorée(s) (légende, titre…).`);

  return { id, name, source: 'drawio', steps, links };
}

/**
 * Lit un fichier draw.io. `fileName` sert à nommer les process ; s'il y a
 * plusieurs pages, chaque process prend le nom « Fichier · Page ».
 */
export function parseDrawio(xml: string, fileName: string, idPrefix = 'drawio'): ImportResult {
  const doc = parseXml(xml);
  const warnings: string[] = [];
  const models: { name: string; model: Element }[] = [];

  const diagrams = doc.getElementsByTagName('diagram');
  if (diagrams.length === 0) {
    const model = doc.getElementsByTagName('mxGraphModel')[0];
    if (!model) throw new ImportError('Ce fichier ne contient aucune page draw.io.');
    models.push({ name: 'Page 1', model });
  }
  for (let i = 0; i < diagrams.length; i++) {
    const diagram = diagrams[i];
    const name = diagram.getAttribute('name') || `Page ${i + 1}`;
    let model = diagram.getElementsByTagName('mxGraphModel')[0];
    if (!model) {
      const raw = (diagram.textContent ?? '').trim();
      if (!raw) {
        warnings.push(`${name} : page vide.`);
        continue;
      }
      try {
        model = parseXml(inflateDiagram(raw)).getElementsByTagName('mxGraphModel')[0];
      } catch {
        model = undefined as unknown as Element;
      }
      if (!model) {
        warnings.push(`${name} : page compressée illisible.`);
        continue;
      }
    }
    models.push({ name, model });
  }

  const baseName = fileName.replace(/\.(drawio|xml)$/i, '').trim() || 'Process importé';
  const processes: Process[] = [];
  models.forEach(({ name, model }, index) => {
    const processName = models.length > 1 ? `${baseName} · ${name}` : baseName;
    const process = buildPage(model, name, `${idPrefix}-${index + 1}`, processName, warnings);
    if (process) processes.push(process);
    else warnings.push(`${name} : aucune étape reliée, page ignorée.`);
  });

  if (processes.length === 0) throw new ImportError('Aucune étape reliée par des flèches dans ce fichier.');
  return { processes, warnings };
}
