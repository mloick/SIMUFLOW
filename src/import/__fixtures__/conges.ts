/**
 * Schémas draw.io fictifs pour les tests : une demande de congés avec deux
 * couloirs (Salarié, Manager), une décision et ses libellés.
 */

import { deflateSync, strToU8 } from 'fflate';

export const MODELE_CONGES = `<mxGraphModel><root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <mxCell id="lane-s" value="Salarié" style="swimlane;horizontal=0;" vertex="1" parent="1">
    <mxGeometry x="0" y="0" width="600" height="160" as="geometry"/>
  </mxCell>
  <mxCell id="lane-m" value="Manager" style="swimlane;horizontal=0;" vertex="1" parent="1">
    <mxGeometry x="0" y="160" width="600" height="160" as="geometry"/>
  </mxCell>
  <mxCell id="debut" value="Début" style="ellipse;whiteSpace=wrap;" vertex="1" parent="lane-s">
    <mxGeometry x="40" y="50" width="60" height="60" as="geometry"/>
  </mxCell>
  <mxCell id="saisir" value="&lt;b&gt;Saisir la demande&lt;/b&gt;&lt;br&gt;1 JO" style="rounded=1;" vertex="1" parent="lane-s">
    <mxGeometry x="140" y="50" width="120" height="60" as="geometry"/>
  </mxCell>
  <UserObject label="Accord ?" id="accord">
    <mxCell style="rhombus;" vertex="1" parent="lane-m">
      <mxGeometry x="300" y="40" width="80" height="80" as="geometry"/>
    </mxCell>
  </UserObject>
  <mxCell id="valider" value="Valider dans l'outil&lt;br&gt;2 jours ouvrés" style="rounded=1;" vertex="1" parent="lane-m">
    <mxGeometry x="440" y="50" width="120" height="60" as="geometry"/>
  </mxCell>
  <mxCell id="refuser" value="Expliquer le refus" style="rounded=1;" vertex="1" parent="lane-s">
    <mxGeometry x="440" y="50" width="120" height="60" as="geometry"/>
  </mxCell>
  <mxCell id="fin" value="Demande close" style="rounded=1;" vertex="1" parent="1">
    <mxGeometry x="640" y="140" width="100" height="40" as="geometry"/>
  </mxCell>
  <mxCell id="note" value="Brouillon à relire" style="text;strokeColor=none;fillColor=none;" vertex="1" parent="1">
    <mxGeometry x="0" y="340" width="200" height="30" as="geometry"/>
  </mxCell>
  <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="debut" target="saisir">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e2" edge="1" parent="1" source="saisir" target="accord">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e3" value="oui" edge="1" parent="1" source="accord" target="valider">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e4" edge="1" parent="1" source="accord" target="refuser">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e4-label" value="non" style="edgeLabel;" vertex="1" connectable="0" parent="e4">
    <mxGeometry x="-0.2" relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e5" edge="1" parent="1" source="valider" target="fin">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e6" edge="1" parent="1" source="refuser">
    <mxGeometry relative="1" as="geometry">
      <mxPoint x="650" y="160" as="targetPoint"/>
    </mxGeometry>
  </mxCell>
</root></mxGraphModel>`;

export const FICHIER_CONGES = `<mxfile host="app.diagrams.net"><diagram id="p1" name="Congés">${MODELE_CONGES}</diagram></mxfile>`;

/** Même schéma, page compressée comme le fait draw.io par défaut. */
export function fichierCompresse(): string {
  const bytes = deflateSync(strToU8(encodeURIComponent(MODELE_CONGES)));
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return `<mxfile><diagram id="p1" name="Congés">${btoa(binary)}</diagram><diagram id="p2" name="Vide"></diagram></mxfile>`;
}
