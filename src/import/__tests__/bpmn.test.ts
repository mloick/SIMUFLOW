import { describe, expect, it } from '@jest/globals';

import { countPaths, diagnose } from '@/domain';
import { ImportError, importProcessFile, parseBpmn } from '@/import';

import { lireExemple } from '../../../jest/lire-exemple';

const exemple = new TextDecoder().decode(lireExemple('demande-achat.bpmn'));

const ns = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"';
const bpmn = (body: string, extra = '') => `<bpmn:definitions ${ns}>${extra}${body}</bpmn:definitions>`;

describe('parseBpmn', () => {
  const { processes, warnings } = importProcessFile('demande-achat.bpmn', exemple, 'b');
  const [process] = processes;
  const step = (id: string) => process.steps.find((one) => one.id === id);

  it('lit les étapes, les décisions, les couloirs et la mise en page', () => {
    expect(processes).toHaveLength(1);
    expect(process.name).toBe('Achats de fournitures');
    expect(process.source).toBe('bpmn');
    expect(step('debut')).toMatchObject({ kind: 'start', title: "Besoin d'achat", actor: 'Demandeur' });
    expect(step('fin')).toMatchObject({ kind: 'end', title: 'Demande close' });
    expect(step('gw_ok')).toMatchObject({ kind: 'decision', title: 'Demande validée ?', actor: 'Responsable' });
    expect(step('valider')).toMatchObject({ kind: 'task', duration: 2, shape: 'userTask' });
    expect(step('attente')).toMatchObject({ kind: 'task', duration: 5, actor: 'Service Achats' });
    expect(step('split')).toMatchObject({ kind: 'task', title: 'En parallèle' });
    // Un événement de 36 × 36 est agrandi autour de son centre pour que son nom tienne.
    expect(step('debut')?.layout).toEqual({ x: 193, y: 127, width: 90, height: 56 });
    expect(step('valider')?.layout).toEqual({ x: 450, y: 265, width: 110, height: 80 });
  });

  it('donne leur libellé aux branches et retire les passerelles qui réunissent', () => {
    expect(process.links.filter((link) => link.from === 'gw_ok').map((link) => link.label).sort()).toEqual(['non', 'oui']);
    expect(step('join')).toBeUndefined();
    expect(step('merge')).toBeUndefined();
    expect(process.links.filter((link) => link.to === 'attente').map((link) => link.from).sort()).toEqual(['budget', 'commander']);
    expect(process.links.filter((link) => link.to === 'fin').map((link) => link.from).sort()).toEqual(['livrer', 'refus']);
  });

  it('donne un process que le diagnostic et la simulation acceptent', () => {
    expect(diagnose(process).filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(countPaths(process).count).toBe(3);
    expect(warnings).toEqual(['Achats de fournitures : 1 annotation(s) non lu(s).']);
  });

  it('lit un fichier sans préfixe, avec conditions, sous-couloirs et plusieurs participants', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <collaboration><participant name="Client" processRef="p1"/><participant name="Support" processRef="p2"/>
        <messageFlow sourceRef="a" targetRef="x"/></collaboration>
      <process id="p1"><startEvent id="a"/><task id="b" name="Écrire"/><endEvent id="c"/>
        <sequenceFlow id="s1" sourceRef="a" targetRef="b"/><sequenceFlow id="s2" sourceRef="b" targetRef="c"/></process>
      <process id="p2"><laneSet><lane name="Support"><childLaneSet><lane name="Niveau 1"><flowNodeRef>x</flowNodeRef><flowNodeRef>g</flowNodeRef></lane></childLaneSet></lane></laneSet>
        <startEvent id="x"/><exclusiveGateway id="g"/><task id="y" name="Résoudre"/><endEvent id="z"/>
        <sequenceFlow id="t1" sourceRef="x" targetRef="g"/>
        <sequenceFlow id="t2" sourceRef="g" targetRef="y"><conditionExpression>urgent</conditionExpression></sequenceFlow>
        <sequenceFlow id="t3" sourceRef="g" targetRef="z" name="sinon"/><sequenceFlow id="t4" sourceRef="y" targetRef="z"/></process>
    </definitions>`;
    const result = parseBpmn(xml, 'support.bpmn');
    expect(result.processes.map((one) => one.name)).toEqual(['support · Client', 'support · Support']);
    expect(result.processes[0].steps.find((one) => one.id === 'b')?.actor).toBe('Client');
    const support = result.processes[1];
    expect(support.steps.find((one) => one.id === 'g')).toMatchObject({ kind: 'decision', title: 'Décision', actor: 'Niveau 1' });
    expect(support.steps.find((one) => one.id === 'x')).toMatchObject({ title: 'Début' });
    expect(support.links.find((one) => one.id === 't2')?.label).toBe('urgent');
    expect(result.warnings).toContain('1 flux de message entre participants non lu(s) : chaque participant est un process à part.');
  });

  it('refuse un fichier qui n’est pas du BPMN, ou sans étape reliée', () => {
    expect(() => parseBpmn('<mxfile/>', 'x.bpmn')).toThrow(ImportError);
    expect(() => parseBpmn(bpmn('<bpmn:process id="p"><bpmn:task id="a"/></bpmn:process>'), 'x.bpmn')).toThrow(
      'Aucune étape reliée par des flux dans ce fichier BPMN.',
    );
  });
});
