/**
 * Export d'un process en BPMN 2.0 (.bpmn), à ouvrir dans Camunda Modeler,
 * bpmn.io, Bizagi, Signavio… ou à réimporter dans SimuFlow (voir docs/bpmn.md).
 *
 * - départ → startEvent, fin → endEvent, décision → exclusiveGateway, étape →
 *   task (ou le genre d'origine d'un process importé de BPMN : userTask,
 *   serviceTask, parallelGateway…) ;
 * - liens → sequenceFlow, avec le libellé de la branche comme nom ;
 * - un participant (pool) au nom du process, et un couloir (lane) par acteur ;
 * - le délai est écrit dans le nom (« Valider (2 JO) ») pour être lu dans
 *   tous les outils ; le délai et le titre exacts sont gardés dans les
 *   attributs `simuflow:duree` et `simuflow:titre` pour revenir tels quels à
 *   l'import.
 *
 * La mise en page est celle des outils BPMN : les couloirs en bandes
 * horizontales, une colonne par niveau (la longueur du plus long chemin qui
 * mène à l'étape), le process se lisant de gauche à droite.
 */

import type { Process, Step } from '@/domain';
import { durationOf } from '@/import/text';
import { computeRanks } from '@/simulation/layout';
import { formatNumber } from '@/utils/format';

export const SIMUFLOW_BPMN_NS = 'https://mloick.github.io/SIMUFLOW/bpmn';

/** Genres d'origine gardés tels quels (process importé d'un fichier BPMN). */
const KEPT_TYPES = new Set([
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
  'intermediateCatchEvent',
  'intermediateThrowEvent',
  'parallelGateway',
  'inclusiveGateway',
  'complexGateway',
  'eventBasedGateway',
]);
const GATEWAY = /Gateway$/;
const EVENT = /Event$/;

/** Taille des formes, comme dans les outils BPMN. */
const SIZES = {
  task: { width: 110, height: 80 },
  event: { width: 36, height: 36 },
  gateway: { width: 50, height: 50 },
};
const COLUMN = 170;
const ROW = 110;
/** Bande du nom, à gauche du pool et de chaque couloir. */
const BAND = 30;
const ORIGIN = 20;
/** Couloir sans nom des étapes sans acteur : il ne donne aucun acteur à l'import. */
const UNASSIGNED = '';

/** Échappe un texte pour un attribut XML. */
function attr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}

function elementType(step: Step): string {
  if (step.kind === 'start') return 'startEvent';
  if (step.kind === 'end') return 'endEvent';
  if (step.kind === 'decision') {
    return step.shape && GATEWAY.test(step.shape) && step.shape !== 'parallelGateway' ? step.shape : 'exclusiveGateway';
  }
  if (step.shape && KEPT_TYPES.has(step.shape) && !/^(inclusive|complex|eventBased)Gateway$/.test(step.shape)) return step.shape;
  return 'task';
}

function sizeOf(type: string) {
  if (EVENT.test(type)) return SIZES.event;
  if (GATEWAY.test(type)) return SIZES.gateway;
  return SIZES.task;
}

/** Nom affiché : le titre, suivi du délai s'il n'y est pas déjà écrit. */
function nameOf(step: Step): string {
  if (step.duration === undefined || durationOf(step.title) !== undefined) return step.title;
  return `${step.title} (${formatNumber(step.duration)} JO)`;
}

const round = (value: number) => Math.round(value);

export function processToBpmn(process: Process): string {
  const ranks = computeRanks(process);
  const ordered = [...process.steps].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0));

  // Identifiants XML valides, stables d'un export à l'autre.
  const ids = new Map(process.steps.map((step, index) => [step.id, `Etape_${index + 1}`]));
  const links = process.links.filter((link) => ids.has(link.from) && ids.has(link.to));
  const flowId = (index: number) => `Flux_${index + 1}`;

  // Couloirs dans l'ordre où les acteurs apparaissent ; sans aucun acteur, pas de couloir.
  const hasLanes = process.steps.some((step) => step.actor);
  const laneOf = (step: Step) => (hasLanes ? (step.actor ?? UNASSIGNED) : '');
  const laneNames: string[] = [];
  for (const step of ordered) if (!laneNames.includes(laneOf(step))) laneNames.push(laneOf(step));

  // Étapes d'un même niveau dans un même couloir : l'une sous l'autre.
  const slot = new Map<string, number>();
  const used = new Map<string, number>();
  for (const step of ordered) {
    const key = `${laneOf(step)}|${ranks.get(step.id) ?? 0}`;
    slot.set(step.id, used.get(key) ?? 0);
    used.set(key, (used.get(key) ?? 0) + 1);
  }
  const rows = laneNames.map((name) =>
    Math.max(1, ...[...used].filter(([key]) => key.startsWith(`${name}|`)).map(([, count]) => count)),
  );
  const laneTop: number[] = [];
  let y = ORIGIN;
  for (const count of rows) {
    laneTop.push(y);
    y += count * ROW;
  }
  const maxRank = Math.max(0, ...ordered.map((step) => ranks.get(step.id) ?? 0));
  const poolWidth = BAND * (hasLanes ? 2 : 1) + (maxRank + 1) * COLUMN + 20;
  const poolHeight = y - ORIGIN;
  const contentX = ORIGIN + BAND * (hasLanes ? 2 : 1) + 20;

  type Box = { x: number; y: number; width: number; height: number; cx: number; cy: number };
  const boxes = new Map<string, Box>();
  const types = new Map<string, string>();
  for (const step of process.steps) {
    const type = elementType(step);
    const { width, height } = sizeOf(type);
    const lane = laneNames.indexOf(laneOf(step));
    const cx = contentX + (ranks.get(step.id) ?? 0) * COLUMN + SIZES.task.width / 2;
    const cy = laneTop[lane] + (slot.get(step.id) ?? 0) * ROW + ROW / 2;
    types.set(step.id, type);
    boxes.set(step.id, { x: cx - width / 2, y: cy - height / 2, width, height, cx, cy });
  }

  // Le process : couloirs, éléments (avec leurs flux entrants et sortants), flux.
  const body: string[] = [];
  if (hasLanes) {
    body.push('    <bpmn:laneSet id="Couloirs">');
    laneNames.forEach((name, index) => {
      body.push(`      <bpmn:lane id="Couloir_${index + 1}"${name ? ` name="${attr(name)}"` : ''}>`);
      for (const step of process.steps) {
        if (laneOf(step) === name) body.push(`        <bpmn:flowNodeRef>${ids.get(step.id)}</bpmn:flowNodeRef>`);
      }
      body.push('      </bpmn:lane>');
    });
    body.push('    </bpmn:laneSet>');
  }
  for (const step of process.steps) {
    const type = types.get(step.id)!;
    const name = nameOf(step);
    const exact =
      (name !== step.title ? ` simuflow:titre="${attr(step.title)}"` : '') +
      (step.duration !== undefined ? ` simuflow:duree="${step.duration}"` : '');
    const refs = [
      ...links.flatMap((link, index) => (link.to === step.id ? [`      <bpmn:incoming>${flowId(index)}</bpmn:incoming>`] : [])),
      ...links.flatMap((link, index) => (link.from === step.id ? [`      <bpmn:outgoing>${flowId(index)}</bpmn:outgoing>`] : [])),
    ];
    const open = `    <bpmn:${type} id="${ids.get(step.id)}" name="${attr(name)}"${exact}`;
    body.push(refs.length ? `${open}>\n${refs.join('\n')}\n    </bpmn:${type}>` : `${open} />`);
  }
  links.forEach((link, index) => {
    const name = link.label ? ` name="${attr(link.label)}"` : '';
    body.push(
      `    <bpmn:sequenceFlow id="${flowId(index)}"${name} sourceRef="${ids.get(link.from)}" targetRef="${ids.get(link.to)}" />`,
    );
  });

  // Le dessin : pool, couloirs, formes, flèches.
  const shapes: string[] = [
    `      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">` +
      `<dc:Bounds x="${ORIGIN}" y="${ORIGIN}" width="${poolWidth}" height="${poolHeight}" /></bpmndi:BPMNShape>`,
  ];
  if (hasLanes) {
    laneNames.forEach((_, index) => {
      shapes.push(
        `      <bpmndi:BPMNShape id="Couloir_${index + 1}_di" bpmnElement="Couloir_${index + 1}" isHorizontal="true">` +
          `<dc:Bounds x="${ORIGIN + BAND}" y="${laneTop[index]}" width="${poolWidth - BAND}" height="${rows[index] * ROW}" /></bpmndi:BPMNShape>`,
      );
    });
  }
  for (const step of process.steps) {
    const box = boxes.get(step.id)!;
    const marker = types.get(step.id) === 'exclusiveGateway' ? ' isMarkerVisible="true"' : '';
    shapes.push(
      `      <bpmndi:BPMNShape id="${ids.get(step.id)}_di" bpmnElement="${ids.get(step.id)}"${marker}>` +
        `<dc:Bounds x="${round(box.x)}" y="${round(box.y)}" width="${box.width}" height="${box.height}" /></bpmndi:BPMNShape>`,
    );
  }
  const bottom = ORIGIN + poolHeight;
  // Côtés de départ déjà pris, par forme : deux flèches ne partent pas du même côté d'une passerelle.
  const taken = new Map<string, Set<string>>();
  const take = (id: string, side: string) => {
    const sides = taken.get(id) ?? new Set<string>();
    if (sides.has(side)) return false;
    taken.set(id, sides.add(side));
    return true;
  };
  // Les flèches qui restent dans leur couloir d'abord : elles prennent le côté droit.
  const order = links
    .map((link, index) => ({ link, index }))
    .sort((a, b) => Number(boxes.get(a.link.from)!.cy !== boxes.get(a.link.to)!.cy) - Number(boxes.get(b.link.from)!.cy !== boxes.get(b.link.to)!.cy));
  const routes = new Map<number, [number, number][]>();
  for (const { link, index } of order) {
    const from = boxes.get(link.from)!;
    const to = boxes.get(link.to)!;
    const forward = to.cx > from.cx;
    const gateway = GATEWAY.test(types.get(link.from)!);
    const right = from.cx + from.width / 2;
    const under = Math.min(bottom - 6, Math.max(from.y + from.height, to.y + to.height) + 18);
    let points: [number, number][];
    if (forward && from.cy === to.cy && (!gateway || take(link.from, 'right'))) {
      points = [
        [right, from.cy],
        [to.cx - to.width / 2, to.cy],
      ];
    } else if (forward && gateway && from.cy !== to.cy && take(link.from, to.cy < from.cy ? 'top' : 'bottom')) {
      // Une passerelle part par le haut ou le bas vers une étape d'un autre couloir.
      points = [
        [from.cx, to.cy < from.cy ? from.y : from.y + from.height],
        [from.cx, to.cy],
        [to.cx - to.width / 2, to.cy],
      ];
    } else if (forward) {
      // D'une colonne à la suivante, on tourne entre les deux ; plus loin, juste
      // avant l'arrivée, pour ne pas traverser les étapes des colonnes sautées.
      const end = to.cx - to.width / 2;
      const middle = to.cx - from.cx > COLUMN * 1.5 ? end - 20 : (right + end) / 2;
      if (gateway) take(link.from, 'right');
      points = [
        [right, from.cy],
        [middle, from.cy],
        [middle, to.cy],
        [end, to.cy],
      ];
    } else if (!gateway || take(link.from, 'bottom')) {
      // Retour en arrière (boucle) ou même colonne : par le dessous des deux formes.
      points = [
        [from.cx, from.y + from.height],
        [from.cx, under],
        [to.cx, under],
        [to.cx, to.y + to.height],
      ];
    } else {
      // Le dessous de la passerelle est pris : par la droite, puis par le dessous.
      points = [
        [right, from.cy],
        [right + 16, from.cy],
        [right + 16, under],
        [to.cx, under],
        [to.cx, to.y + to.height],
      ];
    }
    routes.set(index, points);
  }
  links.forEach((link, index) => {
    const points = routes.get(index)!;
    // Libellé de la branche juste après le départ : au-dessus d'une flèche
    // horizontale, à droite d'une flèche verticale.
    const [[sx, sy], [nx, ny]] = points;
    const vertical = nx === sx;
    // Sous une passerelle, son nom est écrit juste dessous : le libellé passe plus bas.
    const labelY = vertical ? (ny > sy ? sy + 30 : sy - 18) : sy - 16;
    const label = link.label
      ? `<bpmndi:BPMNLabel><dc:Bounds x="${round(vertical ? sx + 4 : sx + 6)}" y="${round(labelY)}" width="${Math.min(90, 8 + link.label.length * 6)}" height="14" /></bpmndi:BPMNLabel>`
      : '';
    shapes.push(
      `      <bpmndi:BPMNEdge id="${flowId(index)}_di" bpmnElement="${flowId(index)}">` +
        points.map(([px, py]) => `<di:waypoint x="${round(px)}" y="${round(py)}" />`).join('') +
        label +
        '</bpmndi:BPMNEdge>',
    );
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"' +
      ' xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"' +
      ' xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"' +
      ' xmlns:di="http://www.omg.org/spec/DD/20100524/DI"' +
      ` xmlns:simuflow="${SIMUFLOW_BPMN_NS}"` +
      ' id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="SimuFlow" exporterVersion="1">',
    '  <bpmn:collaboration id="Collaboration_1">',
    `    <bpmn:participant id="Participant_1" name="${attr(process.name)}" processRef="Process_1" />`,
    '  </bpmn:collaboration>',
    `  <bpmn:process id="Process_1" name="${attr(process.name)}" isExecutable="false">`,
    ...body,
    '  </bpmn:process>',
    '  <bpmndi:BPMNDiagram id="Diagram_1">',
    '    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collaboration_1">',
    ...shapes,
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>',
    '</bpmn:definitions>',
    '',
  ].join('\n');
}
