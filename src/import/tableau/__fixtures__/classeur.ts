/**
 * Petit classeur .xlsx fabriqué en code pour les tests, avec ce qu'un vrai
 * Excel écrit : textes partagés (dont un texte enrichi), texte en ligne, date,
 * booléen, formule avec sa valeur, cellules fusionnées, onglet masqué,
 * onglet graphique sans cellules. Données fictives.
 */

import { strToU8, zipSync } from 'fflate';

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <sheets>
    <sheet name="Suivi" sheetId="1" r:id="rId1"/>
    <sheet name="Graphique" sheetId="2" r:id="rId3"/>
    <sheet name="Cachée" sheetId="3" state="hidden" r:id="rId2"/>
  </sheets>
</workbook>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet" Target="chartsheets/sheet1.xml"/>
</Relationships>`;

const STRINGS = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>Famille</t></si>
  <si><t>Situation</t></si>
  <si><r><rPr><b/></rPr><t>Famille </t></r><r><t>X</t></r></si>
  <si><t xml:space="preserve">3 jours ouvrés_x000D_
- Si pas de rep</t></si>
</sst>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;le &quot;dd/mm/yyyy"/></numFmts>
  <cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs>
</styleSheet>`;

const SHEET1 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>OLA 1</t></is></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="b"><v>1</v></c><c r="C2" t="s"><v>3</v></c></row>
    <row r="3"><c r="B3" s="1"><v>46331</v></c><c r="C3"><f>1+2</f><v>3</v></c></row>
    <row r="4"><c r="B4" s="2"><v>46331.5</v></c><c r="D4"><v>0.30000000000000004</v></c></row>
    <row r="6"><c r="A6" s="0"/></row>
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A2:A3"/></mergeCells>
</worksheet>`;

const SHEET2 = `<?xml version="1.0" encoding="UTF-8"?>
<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheetData><x:row><x:c t="inlineStr"><x:is><x:t>Groupe A</x:t></x:is></x:c></x:row></x:sheetData>
</x:worksheet>`;

/** Le classeur fictif, en octets. */
export function classeurFictif(): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(WORKBOOK),
    'xl/_rels/workbook.xml.rels': strToU8(RELS),
    'xl/sharedStrings.xml': strToU8(STRINGS),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(SHEET1),
    'xl/worksheets/sheet2.xml': strToU8(SHEET2),
    'xl/media/image1.png': new Uint8Array([1, 2, 3]),
  });
}
