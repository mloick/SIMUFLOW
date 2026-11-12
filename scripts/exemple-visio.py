#!/usr/bin/env python3
# Usage : python3 scripts/exemple-visio.py docs/exemples/demande-conges.vsdx
"""Génère docs/exemples/demande-conges.vsdx : un schéma Visio fictif (diagramme
fonctionnel croisé : 3 couloirs, une décision, un titre sans connecteur)."""
import sys, zipfile
from xml.sax.saxutils import escape

out = sys.argv[1]
NS = 'http://schemas.microsoft.com/office/visio/2012/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

masters = {1: 'Process', 2: 'Decision', 3: 'Start/End', 4: 'Swimlane', 5: 'Dynamic connector'}
H = 8.5

def cells(**kw):
    return ''.join(f'<Cell N="{k}" V="{v}"/>' for k, v in kw.items())

shapes = []
def shape(id, master, text, x, y, w, h):
    shapes.append(f'<Shape ID="{id}" Type="Shape" Master="{master}">{cells(PinX=x, PinY=y, Width=w, Height=h)}'
                  f'<Text>{escape(text)}</Text></Shape>')

# Couloirs horizontaux (de haut en bas) : 11 pouces de large, 2 de haut.
shape(1, 4, 'Salarié', 5.5, 7, 11, 2)
shape(2, 4, 'Manager', 5.5, 5, 11, 2)
shape(3, 4, 'Service RH', 5.5, 3, 11, 2)
shape(4, 0, 'Demande de congés (exemple fictif)', 5.5, 8.2, 4, 0.4)
shape(10, 3, 'Demande de congés saisie', 1.2, 7, 1.4, 0.6)
shape(11, 1, 'Vérifier le solde (1 j)', 3.2, 3, 1.6, 0.8)
shape(12, 2, 'Solde suffisant ?', 5.2, 3, 1.4, 1)
shape(13, 1, 'Valider les dates (2 j)', 7.2, 5, 1.6, 0.8)
shape(14, 1, 'Prévenir le salarié', 7.2, 7, 1.6, 0.8)
shape(15, 3, 'Demande close', 9.4, 7, 1.4, 0.6)

links = [(20, 10, 11, ''), (21, 11, 12, ''), (22, 12, 13, 'Oui'), (23, 12, 14, 'Non'), (24, 13, 15, ''), (25, 14, 15, '')]
connects = []
for cid, a, b, label in links:
    shapes.append(f'<Shape ID="{cid}" Type="Shape" Master="5">{cells(BeginX=0, BeginY=0, EndX=1, EndY=1, PinX=0, PinY=0, Width=1, Height=0)}'
                  + (f'<Text>{escape(label)}</Text>' if label else '') + '</Shape>')
    connects.append(f'<Connect FromSheet="{cid}" FromCell="BeginX" FromPart="9" ToSheet="{a}" ToCell="PinX" ToPart="3"/>')
    connects.append(f'<Connect FromSheet="{cid}" FromCell="EndX" FromPart="12" ToSheet="{b}" ToCell="PinX" ToPart="3"/>')

page = (f'<?xml version="1.0" encoding="utf-8"?><PageContents xmlns="{NS}" xmlns:r="{R}"><Shapes>'
        + ''.join(shapes) + '</Shapes><Connects>' + ''.join(connects) + '</Connects></PageContents>')
pages = (f'<?xml version="1.0" encoding="utf-8"?><Pages xmlns="{NS}" xmlns:r="{R}">'
         f'<Page ID="0" NameU="Demande de congés" Name="Demande de congés"><PageSheet>{cells(PageWidth=11, PageHeight=H)}</PageSheet><Rel r:id="rId1"/></Page></Pages>')
pages_rels = ('<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
              '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/></Relationships>')
masters_xml = (f'<?xml version="1.0" encoding="utf-8"?><Masters xmlns="{NS}" xmlns:r="{R}">'
               + ''.join(f'<Master ID="{i}" NameU="{n}" Name="{n}"><Rel r:id="rId{i}"/></Master>' for i, n in masters.items())
               + '</Masters>')
content_types = ('<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="xml" ContentType="application/xml"/>'
                 '<Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>'
                 '<Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>'
                 '<Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>'
                 '<Override PartName="/visio/masters/masters.xml" ContentType="application/vnd.ms-visio.masters+xml"/></Types>')
root_rels = ('<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
             '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/></Relationships>')
doc_rels = ('<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/></Relationships>')
document = f'<?xml version="1.0" encoding="utf-8"?><VisioDocument xmlns="{NS}" xmlns:r="{R}"/>'

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, data in [('[Content_Types].xml', content_types), ('_rels/.rels', root_rels), ('visio/document.xml', document),
                       ('visio/_rels/document.xml.rels', doc_rels), ('visio/pages/pages.xml', pages),
                       ('visio/pages/_rels/pages.xml.rels', pages_rels), ('visio/pages/page1.xml', page),
                       ('visio/masters/masters.xml', masters_xml)]:
        zi = zipfile.ZipInfo(name, (2026, 11, 12, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(zi, data)
