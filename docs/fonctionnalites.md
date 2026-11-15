# SimuFlow en bref

SimuFlow vous aide à vérifier un process avant de le mettre en place : vous le voyez s'animer, étape par étape, et l'app vous signale ce qui cloche. Elle marche sur iPhone, sur Android et [dans le navigateur](https://mloick.github.io/SIMUFLOW/app/). Tous les exemples sont fictifs.

Chaque fonctionnalité porte son état : **Disponible** ou **Prévue**. Sous certaines captures, **Plus de captures** déplie les autres écrans.

**Sommaire**

1. [Ajouter un process](#1-ajouter-un-process) : fichier, tableau Excel, photo
2. [Voir et corriger](#2-voir-et-corriger) : liste, projets, diagnostic, éditeur
3. [Simuler et partager](#3-simuler-et-partager) : pas à pas, tous les cas, export, anonymisation, partage avec les acteurs, relecture de sa partie, suivi de la validation, alertes, lien pour les acteurs sans compte
4. [Suivre une vraie demande](#4-suivre-une-vraie-demande) : échéances et rappels
5. [Formulaires de demande](#5-formulaires-de-demande) : voir, remplir et relier un formulaire à son workflow
6. [Compte et données](#6-compte-et-données) : synchronisation, version web, confidentialité
7. [Confort](#7-confort) : mode sombre, grands textes, présentation
8. [Prévu](#8-prévu)

## 1. Ajouter un process

### Depuis un fichier · Disponible

Touchez **Nouveau** dans la liste, choisissez une des huit tuiles (**draw.io**, **BPMN**, **Visio**, **JSON**…) : un encadré explique ce qu'elle attend. Puis choisissez le fichier. L'app montre ce qu'elle a lu (étapes, acteurs, problèmes, ce qu'elle a dû deviner) ; touchez **Importer**, ou **Importer et corriger** pour ouvrir l'éditeur tout de suite.

Le schéma n'a pas besoin d'un style particulier : l'app suit les flèches. Une étape d'où partent plusieurs flèches nommées est une décision, même dessinée en rectangle. Les acteurs viennent des couloirs, d'une légende de couleurs ou du texte des étapes (« Responsable : Comptabilité ») ; l'app garde le service plutôt que le nom des personnes. Un fichier BPMN (Camunda, bpmn.io, Bizagi, Signavio…) ou Visio (`.vsdx`) garde sa mise en page. Pour en savoir plus : [BPMN 2.0 en bref](bpmn.md).

Vos process importés restent sur le téléphone, et sur votre compte si vous êtes connecté. Pour en retirer un : bouton **…** en haut de sa fiche, puis **Supprimer**.

![Nouveau process : les huit sources en tuiles, puis « Texte » choisi avec son aide](captures/etape-r12-import.png)

![Importer un fichier : aperçu, fichier refusé, process importé](captures/etape-5b-import.png)

<details>
<summary>Plus de captures</summary>

![Import BPMN : l'aperçu de l'exemple, puis tous ses chemins dans la simulation](captures/etape-29-import-bpmn.png)

![Import Visio : la carte « Fichier Visio » et l'aperçu de l'exemple, puis ses deux chemins dans la simulation](captures/etape-30-import-visio.png)

![Un schéma sans couleur ni losange : la décision, le départ et les acteurs sont trouvés](captures/etape-L1-lecture-indices.png)

![Un schéma dont les acteurs sont donnés par une légende de couleurs](captures/etape-9-acteurs-legende.png)

![Un process importé retrouvé après redémarrage, et le bouton pour le supprimer](captures/etape-5c-garder.png)

</details>

### Depuis un texte · Disponible

Un process écrit suffit : choisissez **Texte**, collez-le (ou **Choisir un fichier .txt**), puis **Lire le texte**. Une ligne par étape, par exemple :

```
Process : Demande de matériel
1. Employé : Faire la demande
2. Responsable : Demande validée ? (2 JO)
   oui → 3
   non → 5
3. Achats : Passer la commande (1 JO)
4. Logistique : Livrer le matériel (5 JO) → 6
5. Responsable : Prévenir du refus (1 JO) → 6
6. Fin : Demande close
```

L'acteur vient avant « : », le délai entre parenthèses, la suite après une flèche. Sans flèche, l'étape mène à la ligne suivante. Sous une question, une ligne par cas (« oui → 3 »). Une simple liste sans numéros marche aussi. **Voir un exemple** remplit la zone. Pas d'IA : l'app suit ces règles simples, et ce qu'elle ne comprend pas apparaît en remarque, à corriger ensuite dans l'éditeur.

![Lire un texte : l'exemple collé, l'aperçu, puis le process importé](captures/etape-36-import-texte.png)

### Depuis un tableau Excel ou CSV · Disponible

Touchez **+**, puis **Tableau Excel ou CSV**. L'app lit le classeur sur le téléphone, sans l'envoyer nulle part, et dit ce que contient chaque onglet : tableau de process, workflow avec SLA et OLA, template de formulaire, liste, ou onglet non reconnu.

- **Un tableau de process** (Étape, Acteur, Délai, Suite) s'importe tel quel.
- **Un tableau aux colonnes inconnues** (« Pilote », « Durée prévue »…) : touchez **Choisir les colonnes** et donnez le rôle de chacune. L'app retient ces titres pour les tableaux suivants.
- **Un workflow avec SLA et OLA** : chaque ligne (une situation) devient un process prêt à simuler, avec une pastille **Lue sans ambiguïté**, **À vérifier** ou **À corriger**, et pour chaque doute la cellule et la question à poser au métier.
- **Un template de formulaire** : voir la [partie 5](#5-formulaires-de-demande).

Pour essayer : `demande-materiel.xlsx`, `tableau-a-completer.xlsx`, `workflow-sla-ola.xlsx` (dans `docs/exemples/`).

![Ce que l'app a lu dans un classeur de workflow](captures/etape-19a-tableau-workflow.png)

<details>
<summary>Plus de captures</summary>

![La source « Tableau Excel ou CSV »](captures/etape-19a-tableau-source.png)

![Un template de formulaire reconnu](captures/etape-19a-tableau-formulaire.png)

![Un tableau de process en Excel, prêt à importer](captures/etape-19b-tableau-apercu.png)

![Le process importé depuis le tableau](captures/etape-19b-tableau-importe.png)

![Un onglet non reconnu, avec « Choisir les colonnes »](captures/etape-19c-colonnes-non-reconnu.png)

![Le rôle de chaque colonne](captures/etape-19c-colonnes-choix.png)

![Le même tableau, reconnu seul au prochain import](captures/etape-19c-colonnes-reconnu.png)

![Les titres retenus, dans Profil](captures/etape-19c-colonnes-regles.png)

![Un workflow lu : chaque situation devient un process](captures/etape-21-situations-lu.png)

![Les situations par famille, avec leur pastille](captures/etape-21-situations-liste.png)

![Une situation à vérifier : la cellule et la question à poser](captures/etape-21-situations-avertissements.png)

![La situation importée, simulée : tous les chemins et le chemin critique](captures/etape-21-situations-simulation.png)

</details>

### En photographiant un tableau · Disponible

L'onglet **Scanner** ouvre l'appareil photo, avec une ligne qui balaie le viseur. Le bouton **?** donne les conseils pour bien cadrer. Cadrez un tableau (une ligne par étape, avec l'acteur et le délai) et prenez la photo. L'app recadre la feuille, lit le texte **sur le téléphone, sans Internet**, ne garde que le tableau et ignore le texte autour ; les colonnes reconnues s'affichent en pastilles. Touchez **Créer le process** : chaque ligne devient une étape ; une colonne **Suite** (« oui → 3 ; non → 4 ») crée les décisions. **Créer et corriger** ouvre aussi l'éditeur.

Dans le navigateur, **Prendre ou choisir une photo** ouvre l'appareil photo ou une image (une capture d'écran marche aussi). La lecture se fait dans le navigateur, un peu moins finement. Pour essayer : `docs/exemples/tableaux-a-scanner.html`, six tableaux à afficher ou imprimer.

![Scanner : le viseur, puis le tableau lu et ses colonnes](captures/etape-r13-scanner.png)

![Scanner : le tableau trouvé, puis le process créé](captures/etape-10d-process.png)

<details>
<summary>Plus de captures</summary>

![Scanner : l'autorisation, le viseur, puis la photo prise](captures/etape-10a-scanner.png)

![Scanner : un tableau photographié, puis le texte lu ligne par ligne](captures/etape-10b-lecture.png)

![Scanner : la photo recadrée, puis le tableau seul, sans le texte autour](captures/etape-10b-plus-cadrage.png)

![Le Scanner dans le navigateur : choisir une photo, le tableau trouvé, le process créé](captures/etape-17-scanner-web.png)

</details>

## 2. Voir et corriger

### Vos process · Disponible

L'écran **Process** est l'accueil. En haut, votre avatar et **Bonjour** ouvrent votre profil, le bouton **?** explique l'app en trois étapes, et la cloche ouvre les alertes du partage (une pastille rouge compte les nouvelles).

Dessous, la recherche (elle ignore les accents) et des filtres : **Tous**, **À corriger**, **Partagés** et **Exemples**, chacun avec son nombre. Si une vraie demande est en cours de suivi, la carte **Reprendre** y ramène, à la bonne étape.

Chaque process a sa carte : sa source (draw.io, BPMN…) ou qui vous l'a partagé, le nombre d'étapes, de décisions et d'acteurs, et une pastille : vert sans anomalie, orange pour des avertissements, rouge pour des erreurs. Les quatre **Exemples** fictifs sont là pour essayer ; coupez **Afficher les exemples** dans **Réglages** pour les masquer. Le bouton **Nouveau**, en bas, ajoute un process.

![L'accueil en clair et en sombre : la carte Reprendre, les filtres et les cartes des process](captures/etape-r6-accueil.png)

Pendant le chargement, des cartes grises traversées d'un reflet tiennent la place. Sans aucun process, un dessin propose **Ajouter un process** ou **Voir les exemples**. Si le serveur ne répond pas, **Réessayer** relance. Sans réseau, un bandeau dit que vos process restent disponibles.

![Chargement, liste vide, erreur et hors connexion](captures/etape-r7-etats.png)

<details>
<summary>Plus de captures</summary>

![Avant la refonte : la liste sans process à vous, puis avec vos process et les exemples repliés](captures/etape-13b-exemples.png)

![La liste des process et ses différents états](captures/etape-4a-liste.png)

</details>

### Regrouper des process en projets · Disponible

Un **projet** range ensemble les process d'un même chantier, par exemple « Migration du support » avec « Ouvrir un ticket », « Escalader un incident » et « Clôturer une demande ». L'onglet **Projets**, dans la barre du bas, liste vos projets avec leur nombre de process ; **Nouveau projet** en crée un (un nom, une description si vous voulez). Celui qui crée un projet en est le **chef de projet**.

L'écran d'un projet montre sa description et ses process. **Ajouter des process** affiche vos process à cocher : touchez-en un pour le ranger dans le projet, ou l'en sortir. Depuis la fiche d'un process, **Ranger dans un projet** fait la même chose, et peut créer le projet au passage. Un process est dans un seul projet à la fois et reste aussi dans votre liste. Le bouton **…** du projet le renomme ou le supprime : ses process restent, hors projet.

Les projets sont gardés sur le téléphone et, connecté, synchronisés avec votre compte.

![Mes projets sur l'accueil, puis l'écran d'un projet avec ses process](captures/etape-46-projets.png)

![Ranger dans un projet depuis la fiche d'un process, puis Ajouter des process depuis le projet](captures/etape-46-ranger-process.png)

### L'équipe d'un projet · Disponible

Sur l'écran d'un projet, la section **Équipe** montre le chef (★) et les collaborateurs. Le chef invite des collègues avec leur **identifiant** ou leur **adresse e-mail** (il faut être connecté). Toute l'équipe voit le projet dans l'onglet **Projets** (avec « Chef » ou « Collaborateur »), lit tous ses process et peut y ranger les siens. Les process des autres apparaissent avec « Partagé par … » ; on peut les ouvrir, les simuler et suivre une demande, sans les modifier.

Le rôle dépend du projet, pas du compte : on peut être chef d'un projet et collaborateur d'un autre. Le chef touche un collaborateur pour **Nommer chef de projet** (il reste dans le projet comme collaborateur) ou **Retirer du projet**. Un collaborateur peut **Quitter le projet** depuis le bouton **…**. Quand quelqu'un quitte le projet ou en est retiré, ses process en sortent. Si un chef supprime son compte, le projet passe au collaborateur le plus ancien.

Les acteurs restent choisis process par process, dans **Partager** : si le process est rangé dans un projet, les membres de l'équipe sont proposés en premier, et toucher un nom remplit « Qui inviter ? ».

![L'équipe d'un projet vue par le chef, le menu d'un collaborateur, puis un projet vu par un collaborateur](captures/etape-47-equipe-projet.png)

![Mes projets avec le rôle dans chacun, puis Partager qui propose l'équipe du projet](captures/etape-47-partage-equipe.png)

### L'onglet Projets · Disponible

La barre du bas a quatre onglets : **Process**, **Scanner**, **Projets** et **Réglages**. L'onglet Projets range vos projets en deux parties : **Je pilote** (ceux dont vous êtes chef) et **Je suis collaborateur** (ceux d'une autre personne, avec le nom du chef). Chaque carte montre le nombre de process et votre rôle. Les filtres **Tous**, **Je pilote** et **Collaborateur** en haut n'en gardent qu'une partie. Le bouton **Nouveau projet** en bas à droite en crée un. Sans projet, l'écran explique à quoi sert un projet et propose d'en créer un. L'accueil, lui, ne montre plus que les process.

![L'onglet Projets, le filtre Collaborateur, puis l'accueil avec ses quatre onglets](captures/etape-48-onglet-projets.png)

### Voir les problèmes · Disponible

La fiche d'un process donne ses chiffres clés (étapes, chemins possibles, points à corriger), un grand bouton **Lancer la simulation** et quatre raccourcis : **Modifier**, **Exporter**, **Partager**, **Suivre**. Dessous, des sections à déplier, chacune avec son **?** : acteurs, étapes, partage, suivi, et le **diagnostic**, les plus graves en premier : départ ou fin manquant, impasse, chemin qui ne peut jamais finir, étape inatteignable, décision à une seule sortie, branche sans nom. **Voir** descend jusqu'à l'étape concernée et la surligne. Le bouton **…** en haut regroupe le reste : tout exporter, envoyer un résumé, modifier, supprimer.

![La fiche d'un process](captures/etape-r8-detail.png)

### Corriger un process · Disponible

Touchez **Modifier** sur la fiche. En haut, le **SLA client** du process (voir « Mode Délais »). Touchez une étape : changez son titre, son rôle (départ, tâche, décision, fin), son acteur, son délai (OLA) et le nom de ses branches. Vous pouvez aussi **ajouter une étape après**, **ajouter un cas** à une décision, **relier à une autre étape** ou **supprimer l'étape**. Le nombre de points à corriger se met à jour en direct. La fiche garde la trace : « Corrigé dans l'app le … ».

![Corriger une étape, nommer une branche, puis la fiche mise à jour](captures/etape-L2a-editeur.png)

<details>
<summary>Plus de captures</summary>

![Importer et corriger, ajouter un cas à une décision, puis une étape](captures/etape-L2b-ajout.png)

![Relier une étape, la fiche datée de la correction, puis le schéma avec les nouvelles étapes](captures/etape-L2c-corrige.png)

</details>

### L'app apprend de vos corrections · Disponible

Une correction qui vaut pour tout le schéma devient une règle, refaite seule aux imports suivants : un **acteur renommé partout** (« Serv. compta » devient « Comptabilité »), une **forme qui a un sens chez vous** (vos hexagones sont des décisions), ou une **colonne de tableau** (« Pilote » est l'acteur). L'aperçu d'import dit ce qui a été appliqué. Les règles sont dans **Profil**, avec **Oublier**.

![Un import corrigé d'après les règles, puis la liste des règles dans Profil](captures/etape-L3a-regles.png)

<details>
<summary>Plus de captures</summary>

![Les règles dans Profil, avant connexion](captures/etape-L3b-compte.png)

</details>

## 3. Simuler et partager

### Rejouer le process · Disponible

Sur la fiche, touchez **Lancer la simulation** :

- **Pas à pas** : à chaque décision, l'app demande quelle branche suivre ; on peut revenir en arrière.
- **Simple** : le chemin le plus court. **Complexe** : le plus long.

Le **schéma se construit** au fil du parcours : les étapes à venir sont en pointillés, et **Suivi auto** recadre sur l'étape en cours. Pincez ou glissez pour explorer ; le bouton cible y revient, et une petite carte montre où vous êtes dans un grand schéma. En bas, une carte donne l'étape, son acteur et le délai cumulé en jours ouvrés. Le bouton **plein écran** donne toute la place au schéma, et en tournant le téléphone le schéma passe à gauche et la carte à droite.

![La simulation : pas à pas, puis en plein écran](captures/etape-r9-simulation.png)

![La simulation en paysage](captures/etape-r11-paysage.png)

![Le schéma qui se construit pendant la simulation](captures/etape-6b-schema.png)

<details>
<summary>Plus de captures</summary>

![Le schéma qui se construit : la vue se recadre à chaque étape, puis montre tout le chemin](captures/etape-6c-construction.png)

![La simulation : une décision, une impasse, un parcours complet, le mode sombre](captures/etape-6-simulation.png)

</details>

### Voir tous les cas · Disponible

**Tous** affiche le schéma entier avec une couleur par famille de chemins, comme un plan de métro : les flèches contournent les cases et ne se superposent pas. La légende donne le nombre de chemins et les délais de chaque famille ; le **chemin critique** (le plus long) est en trait épais. Touchez une famille pour l'isoler.

![Tous les cas : deux familles en couleur, puis une famille isolée](captures/etape-6b-tous.png)

<details>
<summary>Plus de captures</summary>

![Avant et après : la flèche « Ouvrir l'accès » va directement à « Demande close »](captures/etape-6c-fleches.png)

</details>

### Exporter le schéma · Disponible

Sur la fiche (**Exporter**) ou dans la simulation (bouton en haut à droite), choisissez un format :

- **PDF** : un résumé « En bref » en quelques phrases (par où le process commence, ses cas, le plus rapide et le plus long, les impasses), le schéma en couleur, les familles de chemins et le diagnostic, à envoyer ou imprimer ;
- **draw.io** : à retoucher dans draw.io, un couloir par acteur ;
- **BPMN 2.0** : à ouvrir dans Camunda Modeler, bpmn.io, Bizagi, Signavio… ;
- **JSON** : pour un autre SimuFlow.

SimuFlow sait réimporter ses exports draw.io et BPMN sans perte.

![Exporter le schéma : le choix du format, puis le PDF](captures/etape-6b-export.png)

![Le PDF commence par un résumé « En bref » : chaque cas avec sa couleur sur le schéma](captures/etape-35-en-bref.png)

<details>
<summary>Plus de captures</summary>

![Export BPMN : le choix « BPMN 2.0 », puis le fichier exporté ouvert dans bpmn.io](captures/etape-31-export-bpmn.png)

</details>

### Anonymiser · Disponible

Pour montrer un process sans vrais noms, cochez **Anonymiser les noms** à l'import ou à l'export. Chaque acteur devient **Service A**, **Service B**… ; les e-mails, téléphones et liens sont masqués, ainsi que les mots que vous écrivez dans **Autres mots à masquer**. Les étapes et les délais ne changent pas. À l'export, seul le fichier partagé est anonymisé.

![Anonymiser : l'option à l'import, le process importé avec ses services, puis l'option à l'export](captures/etape-26-anonymisation.png)

### Partager avec les acteurs · Disponible (côté propriétaire)

Sur la fiche d'un de vos process, **Partager avec les acteurs** ouvre **Partager**. Écrivez l'**identifiant** d'un collègue (`julie.martin`, voir **Mon profil**) ou son **adresse e-mail**, choisissez s'il le faut l'**acteur** du schéma dont il s'occupe, puis **Inviter**. Vous pouvez inviter autant de personnes qu'il faut (jusqu'à 100), plusieurs pour un même acteur, et en **retirer**. Il faut être connecté, et le process doit être sur votre compte (il y part à la synchronisation). Les exemples fournis avec l'app ne se partagent pas.

Les membres voient et jouent le process depuis leur compte, sans pouvoir le modifier, et donnent leur avis sur leur partie (voir ci-dessous).

![Partager : la liste des membres avec leur acteur, puis une invitation pour « Service B »](captures/etape-39-partage.png)

### Relire et valider ma partie · Disponible

Quand quelqu'un partage un process avec vous, il apparaît dans votre liste, sous **Partagés avec moi**, avec le nom de la personne qui le partage. Vous pouvez l'ouvrir, le simuler et suivre une demande, mais pas le modifier.

Sur sa fiche, **Relire et valider ma partie** ouvre **Ma partie** : les étapes de l'acteur qui vous est confié (par exemple « Achats »), ou tout le process si aucun acteur ne vous est confié. **Tout le process** montre aussi les autres étapes. Pour chaque étape :

- **✓ Valider** : l'étape est juste ;
- **À revoir…** : dites ce qui ne va pas (délai, acteur, étape manquante…), puis **Enregistrer mon avis**.

Chaque avis part tout de suite sur votre compte, et vous pouvez le changer ou le retirer. En haut, un encadré compte les étapes validées, à revoir et à relire, puis vous remercie quand votre partie est relue. Seuls vous et le propriétaire du process voyez vos avis : les autres membres ne les voient pas. Il n'y a pas de messagerie, seulement un commentaire par étape.

![Ma partie : le process partagé dans la liste, sa fiche, puis une étape validée et une étape à revoir avec son commentaire](captures/etape-40-ma-partie.png)

### Suivre la validation · Disponible

Dès qu'un process est partagé, sa fiche montre, sous **Partager avec les acteurs**, la carte **Suivi de la validation** : « 2 membres sur 3 ont fini · 1 étape à revoir », avec une pastille **En cours**, **À revoir** ou **Validé**. Elle ouvre l'écran **Suivi de la validation** :

- un encadré qui résume où en est la relecture, et **« Process entièrement validé »** quand chaque membre a relu sa partie sans rien laisser à revoir ;
- **Membres** : pour chacun, son acteur, le nombre d'étapes validées, et **Terminé**, **À revoir**, **En cours** ou **Pas commencé** ;
- **Étapes** : pour chaque étape, qui l'a validée, et les commentaires « à revoir » avec leur auteur. **À revoir** n'affiche que les étapes à corriger.

Corrigez une étape dans **Modifier le process** : le membre voit la nouvelle version et peut changer son avis. **Actualiser** relit les avis. Vous êtes aussi prévenu par une alerte (voir ci-dessous).

![Suivi de la validation : la carte sur la fiche, les membres et leur avancement, une étape à revoir avec son commentaire, puis « Process entièrement validé »](captures/etape-41-suivi-validation.png)

### Alertes du partage · Disponible

SimuFlow vous prévient dans trois cas :

- **Nouveau process partagé** : quelqu'un partage un process avec vous ;
- **Une étape à revoir** : un membre signale une étape de votre process ;
- **Process entièrement validé** : tous les membres ont validé votre process.

Les alertes arrivent quand l'app se synchronise : à l'ouverture, au retour dans l'app, quand le réseau revient, ou avec **Synchroniser**. Sur iPhone et Android, chacune s'affiche aussi en notification, et la toucher ouvre le process ou son suivi. Dans le navigateur, il n'y a pas de notification, mais la cloche de l'accueil compte les nouvelles alertes. Il ouvre l'écran **Alertes**, qui les garde toutes. Dans **Profil**, **Alertes du partage** coupe les notifications, et **Voir les alertes** ouvre la liste.

Il n'y a pas de serveur de notifications : c'est l'app qui regarde ce qui a changé quand elle s'ouvre. Une alerte n'arrive donc pas tant que l'app reste fermée.

![Alertes du partage : le bandeau sur la liste des process, l'écran Alertes, puis le réglage dans le Profil](captures/etape-42-alertes.png)

### Lien pour les acteurs sans compte · Disponible

Un acteur n'a pas SimuFlow ? Dans **Partager**, la section **Liens pour les acteurs sans compte** liste les acteurs du schéma. Pour chacun :

- **Créer un lien**, puis **Envoyer** : la feuille de partage du téléphone (Messages, Mail…), ou dans le navigateur une copie du lien ;
- **Retirer** : le lien ne s'ouvre plus, et les avis donnés par ce lien sont retirés.

La personne ouvre le lien dans son navigateur, sans compte ni installation. La page lui dit qui demande la relecture et de quelle partie il s'agit, puis demande : **« Vous êtes « Achats » ? Écrivez votre nom pour le confirmer. »** Après **C'est moi, je relis ma partie**, elle relit ses étapes comme un membre : **✓ Valider**, ou **À revoir…** avec un commentaire. Chaque avis porte son nom.

De votre côté, le lien compte comme un membre dans **Suivi de la validation** (« Inès Moreau (lien) »), et ses avis déclenchent les mêmes alertes. Le nom écrit est une confirmation, pas une preuve d'identité : envoyez chaque lien à la bonne personne, et retirez-le s'il circule trop.

![Lien pour les acteurs sans compte : les liens dans Partager, la page du lien qui demande le nom, la relecture, puis l'avis dans le suivi de la validation](captures/etape-43-lien-acteur.png)

## 4. Suivre une vraie demande

### Suivi en vrai · Disponible

Sur la fiche, **Suivre** démarre un suivi. Chaque étape reçoit son échéance en **jours ouvrés** (du lundi au vendredi, de 9 h à 17 h, sans les jours fériés). Touchez **Étape terminée**, ou choisissez la branche à une décision. Une pastille dit si l'étape est **à l'heure**, **proche de l'échéance** ou **en retard**.

L'étape en cours est en grand ; les étapes passées s'alignent en frise, cochées.

![Le suivi d'une demande et l'export, avec le nouveau style](captures/etape-r14-ecrans.png)

![Suivi en vrai : les demandes d'un process, une demande en cours, puis l'étape suivante](captures/etape-11b-suivi.png)

### Rappels d'échéance · Disponible

Dans **Réglages**, activez **Rappels d'échéance**. Le téléphone vous prévient **le matin du jour de l'échéance**, puis **à l'échéance** si l'étape n'est pas finie ; toucher le rappel ouvre la demande. Tout est programmé sur le téléphone, sans serveur. **Envoyer une notification d'essai** en envoie une 5 secondes plus tard.

![Profil : la section Notifications, en clair et en sombre](captures/etape-11a-notifications.png)

### Mode Délais (SLA / OLA) · Disponible

Deux délais, comme dans un outil de tickets :

- l'**OLA** est le délai d'une étape pour son équipe (par exemple 3 jours ouvrés pour le groupe A) ;
- le **SLA** est le délai promis au client pour toute la demande (par exemple 6 jours ouvrés).

**D'où viennent les délais.** Ils sont lus à l'import : dans un classeur « SLA / OLA », chaque situation reçoit son SLA et chaque task son OLA ; dans un tableau simple, la colonne **OLA** (ou Délai) donne le délai des étapes et une cellule « SLA : 5 JO » au-dessus du tableau donne le SLA ; dans un texte, une ligne « SLA : 4 JO ». On peut aussi les saisir à la main dans **Modifier** : le champ **SLA client** en haut, et le **Délai OLA** dans chaque étape.

**Sur la fiche**, la section **Délais (SLA / OLA)** donne le SLA, le chemin le plus long (en additionnant les OLA) et dit s'il tient dans le SLA.

**Pendant un suivi**, deux chronos affichent le temps de travail restant : celui du **SLA client** en haut, celui de l'**OLA de l'étape** dans l'étape en cours. Ils sont **verts** au début, passent à l'**orange** quand les trois quarts du délai sont passés, puis au **rouge** une fois le délai dépassé. Une notification prévient quand le SLA est **bientôt dépassé**, puis quand il l'est. À la fin, le **bilan des délais** dit si le SLA a été tenu (avec l'avance ou le retard) et combien d'OLA ont été tenus.

![Mode Délais pendant un suivi : le chrono du SLA en orange et celui de l'OLA en vert, puis le bilan d'une demande terminée](captures/etape-35-delais-suivi.png)

**Dans la simulation**, une barre sous l'étape compare les jours cumulés au SLA, en vert, orange puis rouge ; à la fin, l'app dit « SLA tenu » ou « SLA dépassé ».

<details>
<summary>Plus de captures</summary>

![Simulation : la barre du SLA pendant le parcours, puis un chemin qui dépasse le SLA](captures/etape-35-delais-simulation.png)

![La section Délais de la fiche, et le champ SLA client dans l'éditeur](captures/etape-35-delais-editeur.png)

</details>

## 5. Formulaires de demande

### Voir, remplir et relier un formulaire · Disponible

Un **template de formulaire** (un classeur avec les onglets Basic info, Questions, Fulfillment flow…) est reconnu tout seul. **Voir le formulaire** le montre tel que le demandeur le verra, et il se **remplit pour de vrai** : les questions conditionnelles apparaissent selon les réponses, et l'envoi vérifie les réponses obligatoires et les formats avant d'afficher le récapitulatif. Rien n'est envoyé.

L'app nettoie seule les notes laissées pour l'équipe qui construira le formulaire (nom et prénom en deux cases, une pièce jointe par document, choix unique en boutons ronds, champs « et/ou » dont un seul suffit…). Le reste se corrige dans **Modifier le formulaire** : intitulé, type, choix, conditions, pièces jointes, compléments.

Relié à son **workflow** (classeur SLA / OLA, schéma draw.io ou tableau de process, dans le même fichier, en deux fichiers ou plus tard), la réponse choisit la situation : on la simule ou on la suit en vrai, avec les réponses jointes. **Garder ce formulaire** le range dans **Profil**, **Mes formulaires**, et sur votre compte. **Anonymiser le formulaire** remplace les groupes par **Service A**, **B**…

Pour essayer : `template-formulaire.xlsx`, seul ou avec `workflow-sla-ola.xlsx`, ou `formulaire-et-workflow.xlsx`.

![Le formulaire tel que le demandeur le verra](captures/etape-20b-formulaire-apercu.png)

<details>
<summary>Plus de captures : voir et remplir</summary>

![Un template de formulaire reconnu, avec « Voir le formulaire »](captures/etape-20b-formulaire-import.png)

![Un menu déroulant ouvert](captures/etape-20b-formulaire-menu.png)

![Des questions qui ne s'affichent que selon une réponse](captures/etape-20b-formulaire-conditions.png)

![Pièce jointe avec ses documents attendus, puis ce qui se passe après l'envoi](captures/etape-20b-formulaire-piece-jointe.png)

![Le formulaire vide, avec le nombre de questions qui apparaîtront](captures/etape-20c-formulaire-vide.png)

![Envoyer sans répondre : les réponses manquantes en rouge](captures/etape-20c-formulaire-erreurs.png)

![« Non » fait apparaître la question sur le signataire](captures/etape-20c-formulaire-condition.png)

![Un fichier joint, qu'on peut retirer](captures/etape-20c-formulaire-piece-jointe.png)

![Demande prête : le récapitulatif des réponses](captures/etape-20c-formulaire-recapitulatif.png)

</details>

<details>
<summary>Plus de captures : nettoyer et modifier</summary>

![Nom et prénom séparés, longueurs appliquées, une pièce jointe par document, et les documents du choix coché, un par pièce jointe](captures/etape-24-regles-formulaire.png)

![Modifier le formulaire : la liste des questions, une question ouverte, une condition ajoutée, et le résultat dans le formulaire](captures/etape-25-editeur-formulaire.png)

![Compléments : « Autre (préciser) » coché fait apparaître une pièce jointe et sa description ; dans l'éditeur, « Compléter la question », puis le complément en retrait sous sa question](captures/etape-32-complements-formulaire.png)

![Choix unique : l'interrupteur « Plusieurs choix possibles » coupé dans l'éditeur, puis les boutons ronds dans le formulaire](captures/etape-33-choix-unique.png)

![Au moins un des deux : les deux numéros obligatoires au départ, puis le N° de dossier facultatif une fois le N° de contrat rempli ; dans l'éditeur, « Au moins un de ces champs »](captures/etape-34-champs-au-moins-un.png)

![Anonymiser le formulaire : la case et les mots masqués, puis les groupes devenus Service A, B, C](captures/etape-28-anonymiser-formulaire.png)

</details>

<details>
<summary>Plus de captures : workflow lié et formulaires gardés</summary>

![La source « Formulaire et son workflow »](captures/etape-23-import.png)

![Le formulaire ouvert depuis deux fichiers, avec son workflow lié](captures/etape-23-deux-fichiers.png)

![Un classeur qui contient les deux : « Remplir le formulaire »](captures/etape-23-classeur.png)

![Le formulaire et son workflow lié](captures/etape-22-lien-formulaire.png)

![La suite de la demande : la situation choisie et son process](captures/etape-22-lien-suite.png)

![La demande suivie en vrai, avec les réponses du formulaire](captures/etape-22-lien-suivi.png)

![Mes formulaires, dans Profil](captures/etape-22-lien-mes-formulaires.png)

![Mes formulaires dans Profil : gardés sur le téléphone, et sur le compte une fois connecté](captures/etape-27-formulaires-compte.png)

</details>

## 6. Compte et données

### Compte et synchronisation · Disponible

Au premier lancement, SimuFlow s'ouvre sur **Connectez-vous** : connectez-vous, créez un compte, ou touchez **Continuer sans compte** (tout reste alors sur le téléphone ; **Pourquoi un compte ?** l'explique). L'œil à droite du mot de passe l'affiche. Plus tard, dans **Réglages**, touchez la carte du haut (**Se connecter**), puis **Se connecter ou créer un compte**. Le mot de passe demande au moins 8 caractères, avec minuscule, majuscule, chiffre et symbole ; l'app dit ce qui manque. **Mot de passe oublié ?** envoie un lien valable une heure, qui rouvre l'app sur **Nouveau mot de passe**. La connexion est gardée dans le coffre chiffré du téléphone.

Connecté, **Compléter mon profil** (dans la section Compte) demande votre prénom, votre nom, un **identifiant** (proposé d'après votre nom, par exemple `julie.martin`, unique) et votre **fonction habituelle** : **Chef de projet**, **Collaborateur** ou non précisée. C'est une simple mention, qui ne donne aucun droit : le rôle de chef se décide dans chaque projet. L'identifiant servira à vous inviter sur un process partagé.

![Mon profil : l'identifiant proposé d'après le nom, puis un identifiant déjà pris et la variante proposée](captures/etape-38-mon-profil.png)

Connecté, vos process, règles de lecture et formulaires gardés vous suivent sur tous vos appareils. Sans réseau, rien n'est perdu : la liste affiche « Hors connexion » et l'app envoie les changements dès le retour du réseau. **Supprimer mon compte** efface le compte et ses données, sur le serveur et sur le téléphone. Le serveur est hébergé à Paris ; **À propos** dit s'il est joignable.

![Lancement et connexion : clair, sombre, et « Pourquoi un compte ? »](captures/etape-r5-connexion.png)

![Synchronisation : un process venu du compte, le Profil synchronisé, puis hors connexion](captures/etape-8-synchro.png)

<details>
<summary>Plus de captures</summary>

![Création de compte : l'app dit ce qui manque au mot de passe](captures/etape-14c-mot-de-passe.png)

![Mot de passe oublié : l'adresse, l'e-mail envoyé, le nouveau mot de passe, la confirmation, puis un lien expiré](captures/etape-13a-mot-de-passe-oublie.png)

![Connexion : l'écran, un mot de passe incorrect, la création de compte, le Profil connecté, le mode sombre](captures/etape-7c-connexion.png)

![Supprimer son compte : le bouton, la confirmation, un problème de connexion, puis le Profil sans compte](captures/etape-7d-suppression.png)

![Profil : le serveur joignable, puis injoignable](captures/etape-7a-serveur.png)

</details>

### Dans le navigateur · Disponible

SimuFlow s'ouvre sans rien installer : https://mloick.github.io/SIMUFLOW/app/. Tout y est, sauf les rappels. On peut l'**ajouter à l'écran d'accueil** comme une vraie app : la présentation montre les gestes pour iPhone, Android ou ordinateur.

![La version web : le site, la liste, la simulation et le Scanner](captures/etape-16-version-web.png)

<details>
<summary>Plus de captures</summary>

![La page « Installez SimuFlow » de la présentation, sur iPhone et sur Android](captures/etape-18-installer-web.png)

</details>

### Vos données et le site · Disponible

Le site https://mloick.github.io/SIMUFLOW/ présente l'app et sa **politique de confidentialité**. En bref : sans compte, tout reste sur le téléphone ; avec un compte, votre adresse et vos données sont gardées en Union européenne, visibles par vous seul ; les photos du Scanner ne quittent jamais le téléphone.

![Le site : l'accueil et la politique de confidentialité](captures/etape-14a-site.png)

<details>
<summary>Plus de captures</summary>

![Le lien dans le Profil, et la phrase à la création du compte](captures/etape-14a-liens-app.png)

</details>

### Mises à jour sans réinstaller · Disponible

Les corrections qui ne touchent pas aux fonctions du téléphone arrivent toutes seules, au lancement suivant. Dans **Réglages > À propos**, la ligne **Version** indique la version ; son bouton **?** donne la date de la dernière mise à jour reçue.

![La version de l'app en bas du Profil](captures/etape-9-version.png)

## 7. Confort

- **Langue** · Disponible : l'app suit la langue du téléphone (français s'il est en français, anglais sinon). Dans **Réglages > Langue**, choisissez **Automatique**, **Français** ou **English** ; tout change tout de suite, sans relancer l'app. Tous les écrans passent en anglais : la liste, la fiche, la simulation, le suivi, l'import, le Scanner, l'export, les formulaires, le partage et les alertes. Ce que vous importez reste écrit tel quel. Les fichiers exportés, les quatre exemples, les remarques détaillées de lecture d'un tableau Excel et le format du texte à coller restent en français.
- **Couleurs** · Disponible : quatre palettes, chacune en clair et en sombre : **Océan** (le bleu SimuFlow, par défaut), **Aurore** (violet et rose), **Menthe** (vert et ambre) et **Corail** (terre cuite et bleu marine). Touchez une pastille dans **Réglages > Apparence** : toute l'app change tout de suite, et le choix est gardé sur le téléphone. Les textes utilisent une nouvelle police, Plus Jakarta Sans.
- **Explications « ? »** · Disponible : à côté de certains réglages, un petit bouton **?** ouvre une explication en bas de l'écran ; **Compris** la referme. Chaque réglage de l'onglet **Réglages** a le sien. Les boutons, eux, s'enfoncent légèrement sous le doigt (rien ne bouge si « Réduire les animations » est activé).
- **Mode sombre** · Disponible : par défaut, l'app suit le réglage du téléphone. Dans **Réglages > Apparence**, choisissez **Automatique**, **Clair** ou **Sombre** ; le choix est gardé sur le téléphone.
- **Grands textes** · Disponible : si vous agrandissez le texte du téléphone, l'app suit et réorganise ce qui ne tient plus côte à côte.
- **Animations douces** · Disponible : un reflet traverse la liste pendant le chargement, et les cartes arrivent en glissant ; rien ne bouge si « Réduire les animations » est activé.
- **Présentation au premier lancement** · Disponible : après l'écran **Connectez-vous** (ou **Continuer sans compte**), quatre pages, à revoir depuis **Réglages > À propos**.
- **Icône et écran de démarrage** · Disponible : le logo en S, en clair ou en sombre.
- **Réglages** · Disponible : le troisième onglet. En haut, la carte de votre profil ; puis l'apparence, la langue, les notifications, les exemples, et **À propos** (présentation, confidentialité, version, serveur). Un bouton **?** explique chaque réglage.
- **Profil** · Disponible : ouvert par la carte du haut des **Réglages**. Une bannière à vos couleurs avec vos initiales, votre nom, votre identifiant et votre rôle (**Modifier** pour les changer), vos chiffres (process, partagés, formulaires), la synchronisation avec son bouton, vos formulaires et les règles apprises, **Se déconnecter**, et **Supprimer mon compte** replié (toujours demandé deux fois).

![Langue : la présentation et la connexion en anglais sur un téléphone en anglais, le réglage Langue du Profil, puis Français choisi](captures/etape-44-langue.png)

![L'app en anglais : la liste, la fiche d'un process, la simulation et l'import](captures/etape-45-anglais.png)

![Les quatre palettes : Océan, Aurore (dans le Profil), Menthe en sombre, Corail](captures/etape-r1-palettes.png)

![Le nouveau bouton, le « ? » d'Apparence et son explication, en Aurore et en Menthe sombre](captures/etape-r2-briques.png)

![L'onglet Réglages : la carte du profil, l'apparence et la langue, les notifications et À propos, en Corail sombre, puis la page Profil](captures/etape-r3-reglages.png)

![La page Profil : connecté, la suppression dépliée, la carte du profil dans les Réglages, puis sans compte en sombre](captures/etape-r4-profil.png)

![Apparence : Automatique, puis Sombre choisi dans le Profil, et la liste en sombre](captures/etape-37-apparence.png)

![Texte agrandi : le détail d'un process et la simulation](captures/etape-13d-grands-textes.png)

<details>
<summary>Plus de captures</summary>

![La présentation : bienvenue, ajouter ses process, suivre une vraie demande, et le lien dans le Profil](captures/etape-13c-bienvenue.png)

![L'icône sur iOS et Android, et l'écran de démarrage en mode clair et sombre](captures/etape-9-identite.png)

![Le Profil : le compte et les réglages, puis la section À propos](captures/etape-13d-profil.png)

</details>

## 8. Prévu

- **Voir sur le schéma** · Prévue : le bouton « Voir » d'une anomalie montrera aussi l'endroit exact sur le schéma.
- **VoiceOver et TalkBack** · Prévue : une lecture complète par les lecteurs d'écran.
