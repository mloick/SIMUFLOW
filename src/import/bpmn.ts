/**
 * Lecture d'un fichier BPMN 2.0 (.bpmn), le format commun de Camunda,
 * bpmn.io, Bizagi, Signavio… (voir docs/bpmn.md).
 *
 * Un fichier .bpmn est du XML : chaque <process> liste ses éléments
 * (événements, tâches, passerelles) et ses flux (<sequenceFlow>), et ses
 * couloirs (<lane>) disent quels éléments leur appartiennent. La partie
 * <BPMNDiagram> donne la position de chaque forme.
 *
 * On en tire un Process par <process> qui a des éléments reliés :
 * - startEvent → départ, endEvent → fin, tâches et sous-process → étapes,
 *   événements intermédiaires → étapes (« Attendre la réponse ») ;
 * - une passerelle d'où partent plusieurs flux est une décision (exclusive,
 *   inclusive, complexe, sur événement) ou une étape « En parallèle » ; une
 *   passerelle qui ne fait que réunir des branches (un seul flux sortant) est
 *   retirée, ses flux arrivants vont directement à l'étape suivante ;
 * - le nom d'un flux, sinon sa condition, devient le libellé de la branche ;
 * - le couloir le plus précis donne l'acteur ; sans couloir, le nom du
 *   participant (pool) ;
 * - les éléments non lus (événements attachés, messages entre pools, données,
 *   annotations) sont comptés dans les remarques.
 * Les préfixes d'espaces de noms varient d'un outil à l'autre (bpmn:,
 * bpmn2:, semantic:, aucun) : on lit le nom local des balises.
 */

import { DOMParser, type Element } from '@xmldom/xmldom';

import type { Link, Process, Step, StepKind } from '@/domain';

import { ImportError, type ImportResult } from './errors';
import { cellText, durationOf } from './text';

const TASKS = new Set([
  'task',
  'userTask',
  'manualTask',
  'serviceTask',
  'scriptTask',
  'sendTask',
  'receiveTask',
  'businessRuleTask',
  'callActivity',
  'subProcess',
  'adHocSubProcess',
  'transaction',
]);
const EVENTS = new Set(['intermediateCatchEvent', 'intermediateThrowEvent']);
const CHOICES = new Set(['exclusiveGateway', 'inclusiveGateway', 'complexGateway', 'eventBasedGateway']);
const GATEWAYS = new Set([...CHOICES, 'parallelGateway']);
/** Éléments connus, pas encore lus : signalés dans les remarques. */
const SKIPPED: Record<string, string> = {
  boundaryEvent: 'événement(s) attaché(s) à une tâche',
  dataObjectReference: 'donnée(s)',
  dataStoreReference: 'stockage(s) de données',
  textAnnotation: 'annotation(s)',
};

/** Taille minimale d'une forme, pour que son nom tienne dedans. */
const MIN_WIDTH = 90;
const MIN_HEIGHT = 56;

const local = (element: Element) => element.localName ?? element.nodeName.replace(/^.*:/, '');

function children(element: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i] as Element;
    if (child.nodeType === 1) result.push(child);
  }
  return result;
}

function descendants(element: Element, name: string): Element[] {
  const found: Element[] = [];
  const walk = (node: Element) => {
    for (const child of children(node)) {
      if (local(child) === name) found.push(child);
      walk(child);
    }
  };
  walk(element);
  return found;
}

const textOf = (element: Element | undefined) => cellText(element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Le couloir le plus précis de chaque élément (les couloirs peuvent être imbriqués). */
function lanesOf(process: Element): Map<string, string> {
  const owner = new Map<string, string>();
  const visit = (laneSet: Element) => {
    for (const lane of children(laneSet).filter((child) => local(child) === 'lane')) {
      const name = cellText(lane.getAttribute('name')).trim();
      for (const ref of children(lane).filter((child) => local(child) === 'flowNodeRef')) {
        const id = (ref.textContent ?? '').trim();
        if (name && id) owner.set(id, name);
      }
      // Un sous-couloir précise le couloir : il passe après.
      for (const child of children(lane).filter((child) => local(child) === 'childLaneSet')) visit(child);
    }
  };
  for (const laneSet of children(process).filter((child) => local(child) === 'laneSet')) visit(laneSet);
  return owner;
}

/** Position de chaque forme du dessin, par identifiant d'élément. */
function boundsOf(root: Element): Map<string, NonNullable<Step['layout']>> {
  const bounds = new Map<string, NonNullable<Step['layout']>>();
  for (const shape of descendants(root, 'BPMNShape')) {
    const box = children(shape).find((child) => local(child) === 'Bounds');
    const id = shape.getAttribute('bpmnElement');
    if (!box || !id) continue;
    const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((key) => Number(box.getAttribute(key)));
    if (![x, y, width, height].every(Number.isFinite)) continue;
    // Un événement ou une passerelle est petit, son nom écrit à côté : on
    // l'agrandit autour de son centre pour y écrire le nom.
    const w = Math.max(width, MIN_WIDTH);
    const h = Math.max(height, MIN_HEIGHT);
    bounds.set(id, { x: x - (w - width) / 2, y: y - (h - height) / 2, width: w, height: h });
  }
  return bounds;
}

type Node = { id: string; type: string; name: string; duration?: number };

/** Espace de noms de SimuFlow : le titre et le délai exacts d'une étape exportée (`simuflow:titre`, `simuflow:duree`). */
const SIMUFLOW_NS = 'https://mloick.github.io/SIMUFLOW/bpmn';

const simuflowAttribute = (element: Element, name: string) =>
  element.getAttributeNS(SIMUFLOW_NS, name) || element.getAttribute(`simuflow:${name}`) || '';

/** Délai gardé par l'export de SimuFlow, s'il y en a un. */
function exportedDuration(element: Element): number | undefined {
  const value = simuflowAttribute(element, 'duree');
  const duration = value ? Number(value) : NaN;
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}
type Flow = { id: string; from: string; to: string; label?: string };

function readProcess(
  process: Element,
  id: string,
  name: string,
  pool: string | undefined,
  bounds: Map<string, NonNullable<Step['layout']>>,
  warnings: string[],
): Process | null {
  const nodes: Node[] = [];
  const flows: Flow[] = [];
  const skipped = new Map<string, number>();
  for (const element of children(process)) {
    const type = local(element);
    const elementId = element.getAttribute('id');
    if (type === 'sequenceFlow') {
      const from = element.getAttribute('sourceRef');
      const to = element.getAttribute('targetRef');
      if (!from || !to) continue;
      const condition = children(element).find((child) => local(child) === 'conditionExpression');
      const label = cellText(element.getAttribute('name')).trim() || textOf(condition) || undefined;
      flows.push({ id: elementId ?? `${from}-${to}`, from, to, ...(label ? { label } : {}) });
    } else if (elementId && (type === 'startEvent' || type === 'endEvent' || TASKS.has(type) || EVENTS.has(type) || GATEWAYS.has(type))) {
      const name = cellText(element.getAttribute('name')).trim();
      const duration = exportedDuration(element);
      // L'export de SimuFlow ajoute le délai au nom (« Valider (2 JO) ») et garde le titre exact à part.
      const title = cellText(simuflowAttribute(element, 'titre')).trim() || name;
      nodes.push({ id: elementId, type, name: title, ...(duration !== undefined ? { duration } : {}) });
    } else if (SKIPPED[type]) {
      skipped.set(type, (skipped.get(type) ?? 0) + 1);
    }
  }

  const known = new Set(nodes.map((node) => node.id));
  let links = flows.filter((flow) => known.has(flow.from) && known.has(flow.to));
  if (links.length === 0) return null;

  // Une passerelle qui ne fait que réunir des branches disparaît : ses flux
  // arrivants vont directement à l'étape suivante.
  const outgoing = (nodeId: string) => links.filter((link) => link.from === nodeId);
  const removed = new Set<string>();
  for (const node of nodes) {
    if (!GATEWAYS.has(node.type)) continue;
    const out = outgoing(node.id);
    if (out.length !== 1 || out[0].to === node.id) continue;
    const next = out[0];
    links = links
      .filter((link) => link !== next)
      .map((link) => (link.to === node.id ? { ...link, to: next.to, label: link.label ?? next.label } : link));
    removed.add(node.id);
  }

  const lanes = lanesOf(process);
  const steps: Step[] = nodes
    .filter((node) => !removed.has(node.id))
    .filter((node) => links.some((link) => link.from === node.id || link.to === node.id))
    .map((node) => {
      const outs = outgoing(node.id).length;
      let kind: StepKind = 'task';
      if (node.type === 'startEvent') kind = 'start';
      else if (node.type === 'endEvent') kind = 'end';
      else if (CHOICES.has(node.type) && outs >= 2) kind = 'decision';
      const title =
        node.name ||
        (node.type === 'startEvent'
          ? 'Début'
          : node.type === 'endEvent'
            ? 'Fin'
            : node.type === 'parallelGateway'
              ? 'En parallèle'
              : kind === 'decision'
                ? 'Décision'
                : 'Étape sans nom');
      const step: Step = { id: node.id, kind, title, shape: node.type };
      const actor = lanes.get(node.id) ?? pool;
      const duration = node.duration ?? durationOf(node.name);
      const layout = bounds.get(node.id);
      if (actor) step.actor = actor;
      if (duration !== undefined) step.duration = duration;
      if (layout) step.layout = layout;
      return step;
    });

  const finalLinks: Link[] = links.map((link) => ({
    id: link.id,
    from: link.from,
    to: link.to,
    ...(link.label ? { label: link.label } : {}),
  }));
  for (const [type, count] of skipped) warnings.push(`${name} : ${count} ${SKIPPED[type]} non lu(s).`);
  return { id, name, source: 'bpmn', steps, links: finalLinks };
}

function parseXml(text: string): Element {
  let root: Element | null = null;
  try {
    root = new DOMParser({ onError: () => {} }).parseFromString(text, 'text/xml').documentElement as Element | null;
  } catch {
    root = null;
  }
  if (!root || local(root) !== 'definitions') throw new ImportError('Ce fichier n’est pas un schéma BPMN lisible.');
  return root;
}

/** Un fichier BPMN 2.0, reconnu à son espace de noms. */
export function looksLikeBpmn(text: string): boolean {
  return /omg\.org\/spec\/BPMN\/20100524\/MODEL/.test(text.slice(0, 4000));
}

/**
 * Lit un fichier BPMN. Un process prend son nom, sinon celui de son
 * participant, sinon celui du fichier ; un fichier à plusieurs process (un
 * par participant) en donne plusieurs, « Fichier · Participant ».
 */
export function parseBpmn(xml: string, fileName: string, idPrefix = 'bpmn'): ImportResult {
  const root = parseXml(xml);
  const warnings: string[] = [];
  const bounds = boundsOf(root);
  const baseName = fileName.replace(/\.(bpmn|bpmn2|xml)$/i, '') || 'Process BPMN';

  // Le nom de chaque participant (pool), par process.
  const pools = new Map<string, string>();
  for (const participant of descendants(root, 'participant')) {
    const ref = participant.getAttribute('processRef');
    const name = cellText(participant.getAttribute('name')).trim();
    if (ref && name) pools.set(ref, name);
  }
  const messages = descendants(root, 'messageFlow').length;

  const elements = children(root).filter((child) => local(child) === 'process');
  if (elements.length === 0) throw new ImportError('Ce fichier BPMN ne contient aucun process.');
  const processes: Process[] = [];
  elements.forEach((element, index) => {
    const pool = pools.get(element.getAttribute('id') ?? '');
    const given = cellText(element.getAttribute('name')).trim() || pool;
    const label = given || `Process ${index + 1}`;
    const name = elements.length > 1 ? `${baseName} · ${label}` : (given ?? baseName);
    // Sans couloir, le participant est l'acteur, s'il y a plusieurs participants.
    const process = readProcess(element, `${idPrefix}-${index + 1}`, name, elements.length > 1 ? pool : undefined, bounds, warnings);
    if (process) processes.push(process);
    else if (elements.length > 1) warnings.push(`${label} : aucune étape reliée, process ignoré.`);
  });
  if (messages > 0) warnings.push(`${messages} flux de message entre participants non lu(s) : chaque participant est un process à part.`);
  if (processes.length === 0) throw new ImportError('Aucune étape reliée par des flux dans ce fichier BPMN.');
  return { processes, warnings };
}
