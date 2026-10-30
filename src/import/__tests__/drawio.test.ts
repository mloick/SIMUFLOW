import { describe, expect, it } from '@jest/globals';

import { diagnose } from '@/domain';

import { parseDrawio } from '../drawio';
import { ImportError } from '../errors';
import { cellText, durationOf } from '../text';
import { FICHIER_CONGES, fichierCompresse, MODELE_CONGES } from '../__fixtures__/conges';
import { MODELE_LEGENDE } from '../__fixtures__/legende';

describe('parseDrawio', () => {
  const { processes, warnings } = parseDrawio(FICHIER_CONGES, 'Demande de congés.drawio');
  const process = processes[0];
  const step = (id: string) => process.steps.find((s) => s.id === id);

  it('crée un process par page, nommé d’après le fichier', () => {
    expect(processes).toHaveLength(1);
    expect(process).toMatchObject({ name: 'Demande de congés', source: 'drawio' });
  });

  it('reconnaît le rôle des étapes', () => {
    expect(step('debut')?.kind).toBe('start');
    expect(step('saisir')?.kind).toBe('task');
    expect(step('accord')?.kind).toBe('decision');
    expect(step('fin')?.kind).toBe('end');
  });

  it('lit le titre, le délai et l’acteur (couloir)', () => {
    expect(step('saisir')).toMatchObject({ title: 'Saisir la demande', duration: 1, actor: 'Salarié' });
    expect(step('valider')).toMatchObject({ title: "Valider dans l'outil", duration: 2, actor: 'Manager' });
    expect(step('accord')?.title).toBe('Accord ?');
  });

  it('lit l’acteur depuis une légende par couleur, sans couloir', () => {
    const [process] = parseDrawio(MODELE_LEGENDE, 'Achats.drawio').processes;
    const actor = (id: string) => process.steps.find((step) => step.id === id)?.actor;
    expect(actor('demander')).toBe('Demandeur');
    expect(actor('stock')).toBe('Service Achats');
    expect(actor('livrer')).toBe('Service Achats'); // couleur en minuscules
    expect(actor('commander')).toBeUndefined(); // couleur absente de la légende
    expect(process.steps.map((step) => step.id)).not.toContain('pastille-1');
  });

  it('ne prend pas une pastille isolée pour une légende', () => {
    const seule = MODELE_LEGENDE.replace(/<mxCell id="pastille-2"[\s\S]*?<\/mxCell>/, '');
    const [process] = parseDrawio(seule, 'Achats.drawio').processes;
    expect(process.steps.find((step) => step.id === 'demander')?.actor).toBeUndefined();
  });

  it('donne la priorité aux couloirs sur la légende', () => {
    const [process] = parseDrawio(MODELE_CONGES, 'Congés.drawio').processes;
    expect(process.steps.find((step) => step.id === 'saisir')?.actor).toBe('Salarié');
  });

  it('ignore les couloirs et les notes', () => {
    expect(process.steps.map((s) => s.id)).not.toEqual(expect.arrayContaining(['lane-s', 'lane-m', 'note']));
    expect(process.steps).toHaveLength(6);
  });

  it('lit les libellés des flèches, y compris ceux posés à part', () => {
    const labels = process.links.filter((l) => l.from === 'accord').map((l) => l.label);
    expect(labels.sort()).toEqual(['non', 'oui']);
  });

  it('rattache une flèche non accrochée à l’étape la plus proche, avec une remarque', () => {
    expect(process.links.find((l) => l.id === 'e6')).toMatchObject({ from: 'refuser', to: 'fin' });
    expect(warnings[0]).toMatch(/1 flèche\(s\) rattachée/);
  });

  it('donne un process sans anomalie au diagnostic', () => {
    expect(diagnose(process)).toEqual([]);
  });

  it('lit une page compressée et signale une page vide', () => {
    const result = parseDrawio(fichierCompresse(), 'Congés.drawio');
    expect(result.processes).toHaveLength(1);
    expect(result.processes[0].name).toBe('Congés');
    expect(result.processes[0].steps).toHaveLength(6);
    expect(result.warnings).toContain('Vide : page vide.');
  });

  it('accepte un modèle sans enveloppe <mxfile>', () => {
    expect(parseDrawio(MODELE_CONGES, 'modele.xml').processes[0].steps).toHaveLength(6);
  });

  it('refuse un fichier sans page ni étape', () => {
    expect(() => parseDrawio('<html></html>', 'x.xml')).toThrow(ImportError);
    expect(() =>
      parseDrawio('<mxfile><diagram name="A"><mxGraphModel><root/></mxGraphModel></diagram></mxfile>', 'x'),
    ).toThrow('Aucune étape reliée');
  });
});

describe('cellText et durationOf', () => {
  it('retire le HTML et garde les retours à la ligne', () => {
    expect(cellText('<div><b>Valider</b></div><div>2&nbsp;JO &amp; plus</div>')).toBe('Valider\n2 JO & plus');
  });

  it('lit un délai en jours ouvrés', () => {
    expect(durationOf('Traiter\n1,5 jour ouvré')).toBe(1.5);
    expect(durationOf('Traiter 3 BD')).toBe(3);
    expect(durationOf('Traiter vite')).toBeUndefined();
  });
});
