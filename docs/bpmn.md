# BPMN 2.0 en bref

Ce document explique ce qu'est BPMN, ce que contient un fichier `.bpmn`, et ce que SimuFlow en fera. Il prépare l'import des fichiers `.bpmn`, qui n'est pas encore fait.

## Ce que c'est

BPMN veut dire *Business Process Model and Notation*, c'est-à-dire « modèle et notation des process métier ». C'est une **norme** pour dessiner un process avec des formes qui ont le même sens pour tout le monde : un analyste, un métier ou un outil.

- Elle est publiée par l'**OMG** (Object Management Group), un consortium qui écrit aussi UML. La version en usage est **BPMN 2.0**, révisée en 2.0.2 en 2014 ([spécification](https://www.omg.org/spec/BPMN/2.0.2/)).
- Elle est aussi une norme internationale : **ISO/IEC 19510:2013** ([fiche ISO](https://www.iso.org/standard/62652.html)).
- Depuis la version 2.0, la norme ne décrit pas que le dessin. Elle décrit aussi un **format de fichier XML** : un schéma BPMN fait dans un outil peut s'ouvrir dans un autre.

## Les formes principales

| Famille | Forme | Sens |
| --- | --- | --- |
| **Événements** | Cercle fin | Début du process (*start event*) |
| | Cercle épais | Fin du process (*end event*) |
| | Double cercle | Quelque chose arrive en cours de route : un délai, un message (*intermediate event*) |
| **Activités** | Rectangle arrondi | Une tâche (*task*). Une petite icône précise son genre : faite par une personne (*user task*), automatique (*service task*), envoi d'un message… |
| | Rectangle arrondi avec un « + » | Un sous-process, qui regroupe plusieurs tâches |
| **Passerelles** | Losange vide ou avec un « X » | Un choix : une seule branche est suivie (*exclusive gateway*) |
| | Losange avec un « + » | Toutes les branches partent en même temps (*parallel gateway*) |
| | Losange avec un « O » | Une ou plusieurs branches selon les conditions (*inclusive gateway*) |
| **Flux** | Flèche pleine | L'ordre des étapes (*sequence flow*), avec parfois une condition écrite dessus (« oui », « non ») |
| | Flèche pointillée | Un message entre deux participants (*message flow*) |
| **Couloirs** | Grand rectangle | Un participant (*pool*), par exemple une organisation |
| | Bande dans un pool | Un rôle ou un service (*lane*) : ses tâches sont dedans |

## Le fichier .bpmn

Un fichier `.bpmn` est du **XML**. Il a deux parties :

1. **Le process** (`<bpmn:process>`) : la liste des éléments (`startEvent`, `task`, `userTask`, `exclusiveGateway`, `endEvent`…), chacun avec un identifiant et un nom, puis les flux (`sequenceFlow`, avec `sourceRef` et `targetRef`). Les couloirs sont dans `<bpmn:laneSet>` : chaque `lane` liste les éléments qui lui appartiennent (`flowNodeRef`).
2. **Le dessin** (`<bpmndi:BPMNDiagram>`) : la position et la taille de chaque forme (`dc:Bounds`) et le tracé de chaque flèche.

Exemple fictif, réduit à l'essentiel :

```xml
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="demande">
    <bpmn:laneSet>
      <bpmn:lane id="l1" name="Demandeur"><bpmn:flowNodeRef>debut</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="l2" name="Service Achats"><bpmn:flowNodeRef>valider</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="debut" name="Demande reçue" />
    <bpmn:userTask id="valider" name="Valider la demande" />
    <bpmn:endEvent id="fin" name="Demande close" />
    <bpmn:sequenceFlow id="f1" sourceRef="debut" targetRef="valider" />
    <bpmn:sequenceFlow id="f2" sourceRef="valider" targetRef="fin" />
  </bpmn:process>
</bpmn:definitions>
```

## Qui l'utilise

BPMN est le format commun des outils de modélisation de process : **Camunda** (Camunda Modeler), **bpmn.io** (l'éditeur web libre derrière Camunda), **Bizagi Modeler**, **SAP Signavio**, **ARIS**, et **Microsoft Visio** (gabarit BPMN, export `.bpmn` selon les versions). La plupart des outils de gestion des services informatiques (ITSM) ont aussi leur propre éditeur de workflow, mais un schéma pensé avec le métier passe souvent par l'un de ces outils.

## Ce que ça change pour SimuFlow

Le modèle de SimuFlow (des étapes reliées par des liens, voir [`technique.md`](technique.md)) recouvre l'essentiel de BPMN. L'import prévu lira :

| BPMN | SimuFlow |
| --- | --- |
| `startEvent` | Étape de départ |
| `endEvent` | Étape de fin |
| `task` et ses variantes (`userTask`, `serviceTask`…), `subProcess` | Étape (un sous-process devient une seule étape) |
| `exclusiveGateway`, `inclusiveGateway` | Décision ; le nom de chaque flux sortant devient le libellé de la branche |
| `parallelGateway` | Étape d'où partent plusieurs branches : la simulation les propose une à une, comme pour un schéma draw.io (suivre toutes les branches à la fois n'est pas encore fait) |
| `intermediate…Event` | Étape (« Attendre la réponse ») |
| `sequenceFlow` | Lien, avec son nom ou sa condition comme libellé |
| `lane` | Acteur de chaque étape qu'elle contient |
| `dc:Bounds` du dessin | Position de l'étape, pour garder la mise en page d'origine |

Ce qui ne sera pas lu au début : les flux de message entre pools, les événements attachés au bord d'une tâche (*boundary events*), les données (*data objects*) et les annotations. L'import le dira dans ses remarques, comme pour un schéma draw.io. Le diagnostic, la simulation, le suivi et l'export marcheront ensuite comme pour n'importe quel process.

Plus tard, l'**export BPMN** fera le chemin inverse : renvoyer un process vérifié dans SimuFlow vers ces outils.
