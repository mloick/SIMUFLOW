/**
 * Mode Délais : le SLA (délai promis au client pour tout le process) est lu
 * dans chaque format qui peut l'écrire, et revient tel quel à l'export.
 */
import { describe, expect, it } from '@jest/globals';

import { demandeMateriel } from '@/domain/exemples';
import { processToBpmn } from '@/export';
import { parseBpmn } from '@/import';

import { lireExemple } from '../../../jest/lire-exemple';
import { parseProcessJson, processToJson } from '../json';
import { readTableFile, sheetToProcess, situationToProcess, workbookToSituations } from '../tableau';
import { sheetSla } from '../tableau/modeles/simple';
import type { Sheet } from '../tableau/types';
import { slaFromText } from '../text';
import { parseProcessText } from '../texte';

describe('SLA lu à l’import', () => {
  it('reconnaît un SLA écrit dans un texte', () => {
    expect(slaFromText('SLA : 6 JO')).toBe(6);
    expect(slaFromText('SLA client 4,5 jours ouvrés')).toBe(4.5);
    expect(slaFromText('sla = 3')).toBe(3);
    expect(slaFromText('SLA à confirmer')).toBeUndefined();
    expect(slaFromText('SLA 95 %')).toBeUndefined();
    expect(slaFromText('Délai 3 JO')).toBeUndefined();
  });

  it('donne à chaque situation d’un workflow SLA / OLA son SLA, et à ses tasks leur OLA', () => {
    const { situations } = workbookToSituations(
      readTableFile('workflow-sla-ola.xlsx', lireExemple('workflow-sla-ola.xlsx')),
    );
    const process = situationToProcess(situations[0], 'w');
    expect(process.sla).toBe(6);
    expect(process.steps.filter((step) => step.duration).map((step) => step.duration)).toEqual([3, 3]);
  });

  it('lit le SLA écrit au-dessus d’un tableau simple', () => {
    const sheet: Sheet = {
      name: 'Feuil1',
      rows: [
        ['Demande de matériel', '', ''],
        ['SLA', '5 JO', ''],
        ['Étape', 'Responsable', 'OLA'],
        ['Préparer', 'Équipe A', '1 j'],
        ['Vérifier', 'Équipe B', '2 j'],
      ],
      merges: [],
    };
    expect(sheetSla(sheet)).toBe(5);
    const process = sheetToProcess(sheet, 'y')!.processes[0];
    expect(process.sla).toBe(5);
    expect(process.steps.map((step) => step.duration)).toEqual([1, 2]);
  });

  it('lit une ligne « SLA » dans un texte, sans en faire une étape', () => {
    const process = parseProcessText('SLA : 4 JO\n1. Demander (Équipe A, 1 JO)\n2. Valider (Équipe B, 2 JO)', 'Demande')
      .processes[0];
    expect(process.sla).toBe(4);
    expect(process.steps.some((step) => /SLA/.test(step.title))).toBe(false);
  });

  it('garde le SLA à l’aller-retour JSON et BPMN', () => {
    const process = { ...demandeMateriel, sla: 6 };
    expect(parseProcessJson(processToJson(process), 'x.json').processes[0].sla).toBe(6);
    expect(parseBpmn(processToBpmn(process), 'x.bpmn').processes[0].sla).toBe(6);
    expect(parseProcessJson(processToJson(demandeMateriel), 'x.json').processes[0].sla).toBeUndefined();
  });
});
