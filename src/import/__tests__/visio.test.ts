import { describe, expect, it } from '@jest/globals';
import { strToU8, zipSync } from 'fflate';

import { countPaths, diagnose } from '@/domain';
import { ImportError, looksLikeVisio, parseVisio } from '@/import';

import { lireExemple } from '../../../jest/lire-exemple';

const exemple = lireExemple('demande-conges.vsdx');

const NS = 'xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const cells = (values: Record<string, number>) =>
  Object.entries(values)
    .map(([name, value]) => `<Cell N="${name}" V="${value}"/>`)
    .join('');

/** Un petit .vsdx d'une page, sans formes de base (masters). */
function vsdx(shapes: string, connects: string, pageName = 'Page-1') {
  return zipSync({
    'visio/document.xml': strToU8(`<VisioDocument ${NS}/>`),
    'visio/pages/pages.xml': strToU8(
      `<Pages ${NS}><Page ID="0" NameU="${pageName}"><PageSheet>${cells({ PageHeight: 10 })}</PageSheet><Rel r:id="rId1"/></Page></Pages>`,
    ),
    'visio/pages/_rels/pages.xml.rels': strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="page1.xml"/></Relationships>',
    ),
    'visio/pages/page1.xml': strToU8(`<PageContents ${NS}><Shapes>${shapes}</Shapes><Connects>${connects}</Connects></PageContents>`),
  });
}
const box = (id: number, text: string, x: number, y: number, extra = '') =>
  `<Shape ID="${id}">${cells({ PinX: x, PinY: y, Width: 1, Height: 0.5 })}<Text>${text}</Text>${extra}</Shape>`;
const arrow = (id: number, from: number, to: number, label = '') =>
  `<Shape ID="${id}">${cells({ BeginX: 0, EndX: 1 })}${label ? `<Text>${label}</Text>` : ''}</Shape>`;
const glue = (id: number, from: number, to: number) =>
  `<Connect FromSheet="${id}" FromCell="BeginX" ToSheet="${from}"/><Connect FromSheet="${id}" FromCell="EndX" ToSheet="${to}"/>`;

describe('parseVisio', () => {
  const { processes, warnings } = parseVisio(exemple, 'demande-conges.vsdx', 'v');
  const [process] = processes;
  const step = (title: string) => process.steps.find((one) => one.title === title);

  it('lit les formes, les connecteurs, les couloirs et la mise en page', () => {
    expect(looksLikeVisio(exemple)).toBe(true);
    expect(processes).toHaveLength(1);
    expect(process).toMatchObject({ name: 'demande-conges', source: 'visio' });
    expect(process.steps).toHaveLength(6);
    expect(process.links).toHaveLength(6);
    expect(step('Demande de congés saisie')).toMatchObject({ kind: 'start', actor: 'Salarié', shape: 'Start/End' });
    expect(step('Vérifier le solde (1 j)')).toMatchObject({ kind: 'task', actor: 'Service RH', duration: 1 });
    expect(step('Solde suffisant ?')).toMatchObject({ kind: 'decision', actor: 'Service RH' });
    expect(step('Valider les dates (2 j)')).toMatchObject({ kind: 'task', actor: 'Manager', duration: 2 });
    expect(step('Demande close')).toMatchObject({ kind: 'end', actor: 'Salarié' });
    // Pouces → pixels (96 par pouce), axe vertical retourné : PinX 3.2, PinY 3 sur une page de 8.5.
    expect(step('Vérifier le solde (1 j)')?.layout).toEqual({ x: 230, y: 490, width: 154, height: 77 });
  });

  it('garde le libellé des branches et signale les formes non reliées', () => {
    const decision = step('Solde suffisant ?')!;
    const labels = process.links.filter((link) => link.from === decision.id).map((link) => link.label);
    expect(labels.sort()).toEqual(['Non', 'Oui']);
    expect(warnings).toEqual(['Demande de congés : 1 forme(s) sans connecteur ignorée(s) (titre, légende…).']);
    expect(diagnose(process).filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(countPaths(process).count).toBe(2);
  });

  it('sans formes de base, lit le rôle aux flèches et au texte, et place les formes des groupes', () => {
    const group = `<Shape ID="5" Type="Group">${cells({ PinX: 5, PinY: 5, Width: 4, Height: 2, LocPinX: 2, LocPinY: 1 })}<Shapes>${box(6, 'Contrôler', 1, 1)}</Shapes></Shape>`;
    const file = vsdx(
      box(1, 'Début', 1, 5) + box(2, 'Accord ?', 3, 5) + group + box(3, 'Fin', 8, 5) + arrow(10, 1, 2) + arrow(11, 2, 6, 'oui') + arrow(12, 2, 3, 'non') + arrow(13, 6, 3) + arrow(14, 0, 0),
      glue(10, 1, 2) + glue(11, 2, 6) + glue(12, 2, 3) + glue(13, 6, 3) + '<Connect FromSheet="14" FromCell="BeginX" ToSheet="1"/>',
    );
    const { processes: [read], warnings: notes } = parseVisio(file, 'essai.vsdx');
    const kind = (id: string) => read.steps.find((one) => one.id === id)?.kind;
    expect([kind('1'), kind('2'), kind('6'), kind('3')]).toEqual(['start', 'decision', 'task', 'end']);
    // Coin du groupe (3, 4) + position dans le groupe (1, 1) = centre (4, 5).
    expect(read.steps.find((one) => one.id === '6')?.layout).toEqual({ x: 336, y: 456, width: 96, height: 48 });
    expect(notes).toEqual(['Page-1 : 1 connecteur(s) non accroché(s) à deux formes, ignoré(s).']);
  });

  it('refuse un fichier qui n’est pas un .vsdx lisible', () => {
    expect(() => parseVisio(strToU8('pas un zip'), 'x.vsdx')).toThrow(ImportError);
    expect(() => parseVisio(zipSync({ 'a.xml': strToU8('<a/>') }), 'x.vsdx')).toThrow(/\.vsdx/);
    expect(() => parseVisio(vsdx(box(1, 'Seule', 1, 1), ''), 'x.vsdx')).toThrow(/Aucune forme reliée/);
  });
});
