/**
 * Lecture d'un fichier Visio (.vsdx).
 *
 * Un .vsdx est une archive zip de fichiers XML (format Open Packaging) :
 * - `visio/pages/pages.xml` liste les pages (nom, taille) et, par ses liens
 *   (`_rels/pages.xml.rels`), le fichier de chacune (`page1.xml`…) ;
 * - `visio/masters/masters.xml` liste les formes de base (« Process »,
 *   « Decision », « Start/End », « Swimlane », « Dynamic connector »…) ;
 * - chaque page a ses formes (`<Shape>`, avec position et texte) et ses
 *   liaisons (`<Connect>` : quel connecteur part de quelle forme et arrive à
 *   quelle autre).
 *
 * On en tire un Process par page qui a des formes reliées :
 * - un connecteur relie deux formes ; son texte est le libellé de la branche ;
 * - la forme de base donne le rôle : « Decision » → décision, « Start/End »
 *   ou « Terminator » → départ ou fin selon les flèches ; sinon, comme pour
 *   draw.io, une forme d'où partent plusieurs flèches nommées est une
 *   décision, et le texte ou les flèches donnent le départ et la fin ;
 * - les couloirs (« Swimlane », diagramme fonctionnel croisé) donnent l'acteur
 *   des formes dont le centre est dedans ; sinon le texte (« Responsable : … ») ;
 * - les positions (en pouces, axe vertical vers le haut) deviennent des
 *   positions à l'écran, pour garder la mise en page.
 * Les formes sans flèche (titres, légendes) sont ignorées et comptées.
 */

import { DOMParser, type Element } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';

import type { Link, Process, Step, StepKind } from '@/domain';

import { ImportError, type ImportResult } from './errors';
import { actorFromText, durationOf } from './text';

/** Pixels par pouce : la mise en page de l'app est en pixels. */
const PX = 96;

const START_TEXT = /^(start|début|debut|démarrage|demarrage|begin|départ|depart)\b/i;
const END_TEXT = /cl[oô]tur|\bclos(e|es|ed|ure)?(?![A-Za-zÀ-ÿ])|termin[ée]|\bfin\b|\bend\b|\bdone\b/i;

const local = (element: Element) => element.localName ?? element.nodeName.replace(/^.*:/, '');

function children(element: Element, name?: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i] as Element;
    if (child.nodeType === 1 && (!name || local(child) === name)) result.push(child);
  }
  return result;
}

function parseXml(text: string): Element {
  const root = new DOMParser({ onError: () => {} }).parseFromString(text, 'text/xml').documentElement as Element | null;
  if (!root) throw new ImportError('Ce fichier n’est pas un schéma Visio lisible.');
  return root;
}

/** Valeur d'une cellule (`<Cell N="PinX" V="2.5"/>`) d'une forme. */
function cell(shape: Element, name: string): number | undefined {
  const found = children(shape, 'Cell').find((one) => one.getAttribute('N') === name);
  const value = Number(found?.getAttribute('V'));
  return found && Number.isFinite(value) ? value : undefined;
}

/** Texte d'une forme, sans les marques de mise en forme ; un retour à la ligne par paragraphe. */
function shapeText(shape: Element): string {
  const text = children(shape, 'Text')[0];
  if (!text) return '';
  return (text.textContent ?? '')
    .replace(/\r\n?|\u2028|\u2029/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

type Shape = {
  id: string;
  master: string;
  text: string;
  /** Connecteur (forme à une dimension : un début et une fin). */
  connector: boolean;
  /** Centre et taille, en pouces, sur la page. */
  x: number;
  y: number;
  w: number;
  h: number;
};

type Master = { name: string; width?: number; height?: number };

/** Les formes de la page, groupes dépliés, avec leur position sur la page. */
function readShapes(container: Element, masters: Map<string, Master>, offset = { x: 0, y: 0 }, inherited?: string): Shape[] {
  const shapes: Shape[] = [];
  for (const list of children(container, 'Shapes')) {
    for (const shape of children(list, 'Shape')) {
      const id = shape.getAttribute('ID') ?? '';
      const masterId = shape.getAttribute('Master') ?? inherited ?? '';
      const master = masters.get(masterId);
      const w = cell(shape, 'Width') ?? master?.width ?? 1;
      const h = cell(shape, 'Height') ?? master?.height ?? 0.75;
      const pinX = cell(shape, 'PinX') ?? 0;
      const pinY = cell(shape, 'PinY') ?? 0;
      const x = offset.x + pinX;
      const y = offset.y + pinY;
      const name = master?.name ?? shape.getAttribute('NameU') ?? shape.getAttribute('Name') ?? '';
      const connector = cell(shape, 'BeginX') !== undefined || /connect/i.test(name);
      shapes.push({ id, master: name, text: shapeText(shape), connector, x, y, w, h });
      // Les formes d'un groupe sont placées par rapport au coin du groupe.
      if (shape.getAttribute('Type') === 'Group') {
        const corner = { x: x - (cell(shape, 'LocPinX') ?? w / 2), y: y - (cell(shape, 'LocPinY') ?? h / 2) };
        shapes.push(...readShapes(shape, masters, corner, shape.getAttribute('MasterShape') ? masterId : undefined));
      }
    }
  }
  return shapes;
}

const isLane = (shape: Shape) => /swimlane|lane|couloir/i.test(shape.master) && !shape.connector;
const isDecision = (shape: Shape) => /decision|décision/i.test(shape.master);
const isTerminator = (shape: Shape) => /start\/end|terminator|début\/fin|^(start|end|début|fin)$/i.test(shape.master);

function readPage(
  root: Element,
  pageName: string,
  pageHeight: number,
  masters: Map<string, Master>,
  id: string,
  name: string,
  warnings: string[],
): Process | null {
  const shapes = readShapes(root, masters);
  const byId = new Map(shapes.map((shape) => [shape.id, shape]));

  // Les liaisons : pour chaque connecteur, la forme où il commence et celle où il finit.
  const ends = new Map<string, { from?: string; to?: string }>();
  for (const list of children(root, 'Connects')) {
    for (const connect of children(list, 'Connect')) {
      const connector = connect.getAttribute('FromSheet') ?? '';
      const target = connect.getAttribute('ToSheet') ?? '';
      const side = connect.getAttribute('FromCell') ?? '';
      const entry = ends.get(connector) ?? {};
      if (/^Begin/.test(side)) entry.from = target;
      else if (/^End/.test(side)) entry.to = target;
      ends.set(connector, entry);
    }
  }

  const links: Link[] = [];
  let loose = 0;
  for (const [connectorId, { from, to }] of ends) {
    const connector = byId.get(connectorId);
    if (!connector || !from || !to || from === to || !byId.has(from) || !byId.has(to)) {
      loose++;
      continue;
    }
    const label = connector.text.split('\n')[0];
    links.push({ id: connectorId, from, to, ...(label ? { label } : {}) });
  }
  if (links.length === 0) return null;

  const linked = new Set(links.flatMap((link) => [link.from, link.to]));
  const lanes = shapes.filter(isLane);
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  const named = new Map<string, number>();
  for (const link of links) {
    outgoing.set(link.from, (outgoing.get(link.from) ?? 0) + 1);
    incoming.set(link.to, (incoming.get(link.to) ?? 0) + 1);
    if (link.label) named.set(link.from, (named.get(link.from) ?? 0) + 1);
  }

  const nodes = shapes.filter((shape) => linked.has(shape.id));
  const steps: Step[] = nodes.map((shape) => {
    const ins = incoming.get(shape.id) ?? 0;
    const outs = outgoing.get(shape.id) ?? 0;
    const title = shape.text.split('\n')[0] || (isDecision(shape) ? 'Décision' : 'Étape sans nom');
    let kind: StepKind = 'task';
    if (isDecision(shape) && outs >= 2) kind = 'decision';
    else if (outs >= 2 && ((named.get(shape.id) ?? 0) >= 2 || /\?\s*$/.test(title))) kind = 'decision';
    else if (isTerminator(shape) && ins === 0 && outs > 0) kind = 'start';
    else if (isTerminator(shape) && outs === 0 && ins > 0) kind = 'end';
    else if (ins === 0 && outs > 0 && START_TEXT.test(shape.text)) kind = 'start';
    else if (outs === 0 && ins > 0 && END_TEXT.test(title)) kind = 'end';

    // Le couloir le plus petit qui contient le centre de la forme.
    const lane = lanes
      .filter((one) => Math.abs(shape.x - one.x) <= one.w / 2 && Math.abs(shape.y - one.y) <= one.h / 2)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const actor = lane?.text.split('\n')[0] || actorFromText(shape.text);
    const duration = durationOf(shape.text);
    const step: Step = {
      id: shape.id,
      kind,
      title,
      shape: shape.master || 'shape',
      layout: {
        x: Math.round((shape.x - shape.w / 2) * PX),
        y: Math.round((pageHeight - shape.y - shape.h / 2) * PX),
        width: Math.round(shape.w * PX),
        height: Math.round(shape.h * PX),
      },
    };
    if (actor) step.actor = actor;
    if (duration !== undefined) step.duration = duration;
    return step;
  });

  // Sans départ ni fin marqués, les flèches les donnent.
  if (!steps.some((step) => step.kind === 'start')) {
    for (const step of steps) if (step.kind === 'task' && !incoming.get(step.id) && outgoing.get(step.id)) step.kind = 'start';
  }
  if (!steps.some((step) => step.kind === 'end')) {
    for (const step of steps) if (step.kind === 'task' && !outgoing.get(step.id) && incoming.get(step.id)) step.kind = 'end';
  }

  const ignored = shapes.filter((shape) => !shape.connector && !isLane(shape) && !linked.has(shape.id) && shape.text).length;
  if (loose) warnings.push(`${pageName} : ${loose} connecteur(s) non accroché(s) à deux formes, ignoré(s).`);
  if (ignored) warnings.push(`${pageName} : ${ignored} forme(s) sans connecteur ignorée(s) (titre, légende…).`);
  return { id, name, source: 'visio', steps, links };
}

/** Un fichier Visio : une archive zip qui contient `visio/document.xml`. */
export function looksLikeVisio(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && strFromU8(bytes.subarray(0, Math.min(bytes.length, 4000)), true).includes('visio/');
}

/** Lit un fichier .vsdx ; un process par page, « Fichier · Page » s'il y a plusieurs pages. */
export function parseVisio(bytes: Uint8Array, fileName: string, idPrefix = 'visio'): ImportResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => file.name.endsWith('.xml') || file.name.endsWith('.rels') });
  } catch {
    throw new ImportError('Ce fichier n’est pas un schéma Visio lisible (.vsdx).');
  }
  const read = (path: string) => (files[path] ? parseXml(strFromU8(files[path])) : null);
  const pagesXml = read('visio/pages/pages.xml');
  if (!pagesXml) {
    throw new ImportError(
      'Ce fichier n’est pas un schéma Visio lisible. Seul le format .vsdx (Visio 2013 et après) est lu : enregistrez un ancien .vsd en .vsdx.',
    );
  }

  const masters = new Map<string, Master>();
  const mastersXml = read('visio/masters/masters.xml');
  if (mastersXml) {
    for (const master of children(mastersXml, 'Master')) {
      const sheet = children(master, 'PageSheet')[0];
      masters.set(master.getAttribute('ID') ?? '', {
        name: master.getAttribute('NameU') ?? master.getAttribute('Name') ?? '',
        width: sheet ? cell(sheet, 'PageWidth') : undefined,
        height: sheet ? cell(sheet, 'PageHeight') : undefined,
      });
    }
  }

  // Le fichier de chaque page, d'après les liens de pages.xml.
  const targets = new Map<string, string>();
  const rels = read('visio/pages/_rels/pages.xml.rels');
  if (rels) for (const rel of children(rels, 'Relationship')) targets.set(rel.getAttribute('Id') ?? '', rel.getAttribute('Target') ?? '');

  const baseName = fileName.replace(/\.vsdx$/i, '') || 'Schéma Visio';
  const warnings: string[] = [];
  const pages = children(pagesXml, 'Page').filter((page) => page.getAttribute('Background') !== '1');
  const processes: Process[] = [];
  pages.forEach((page, index) => {
    const pageName = page.getAttribute('NameU') ?? page.getAttribute('Name') ?? `Page ${index + 1}`;
    const relId = children(page, 'Rel')[0]?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
      children(page, 'Rel')[0]?.getAttribute('r:id') ?? '';
    const target = targets.get(relId) ?? `page${index + 1}.xml`;
    const content = read(`visio/pages/${target.replace(/^\.\//, '')}`);
    if (!content) {
      warnings.push(`${pageName} : page illisible.`);
      return;
    }
    const sheet = children(page, 'PageSheet')[0];
    const height = (sheet && cell(sheet, 'PageHeight')) ?? 8.5;
    const name = pages.length > 1 ? `${baseName} · ${pageName}` : baseName;
    const process = readPage(content, pageName, height, masters, `${idPrefix}-${index + 1}`, name, warnings);
    if (process) processes.push(process);
    else warnings.push(`${pageName} : aucune forme reliée, page ignorée.`);
  });
  if (processes.length === 0) throw new ImportError('Aucune forme reliée par des connecteurs dans ce fichier Visio.');
  return { processes, warnings };
}
