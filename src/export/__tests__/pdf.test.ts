import { describe, expect, it } from '@jest/globals';

import { copie, demandeMateriel } from '@/domain/exemples';

import { exportFileName, exportText } from '..';
import { processToPdfHtml } from '../pdf';

const colors = ['#111111', '#222222'];

describe('export PDF', () => {
  it('contient le schéma, les familles et le diagnostic', () => {
    const html = processToPdfHtml(demandeMateriel, { colorFamilies: true, colors, date: new Date(2026, 9, 29) });
    expect(html).toContain('<svg');
    expect(html).toContain('Demande validée : oui');
    expect(html).toContain('critique');
    expect(html).toContain('stroke="#111111"');
    expect(html).toContain('Aucune anomalie');
    expect(html).toContain('29 octobre 2026');
  });

  it('liste les anomalies et dessine en bleu sans les familles', () => {
    const process = copie();
    process.links = process.links.filter((link) => link.id !== 'l6');
    const html = processToPdfHtml(process, { colorFamilies: false, colors });
    expect(html).toContain('Impasse');
    expect(html).not.toContain('#111111');
  });
});

describe('fichiers exportés', () => {
  it('nomme le fichier d’après le process', () => {
    expect(exportFileName({ ...demandeMateriel, name: 'Demande d’accès : V2' }, 'drawio')).toBe(
      'demande-d-acces-v2.drawio',
    );
    expect(exportFileName({ ...demandeMateriel, name: '!!!' }, 'pdf')).toBe('process.pdf');
  });

  it('donne un JSON relisible et un draw.io', () => {
    expect(JSON.parse(exportText(demandeMateriel, 'json', { colorFamilies: false, colors })).format).toBe('simuflow');
    expect(exportText(demandeMateriel, 'drawio', { colorFamilies: true, colors })).toContain('<mxfile');
  });
});
