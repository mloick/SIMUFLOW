# SimuFlow en bref

SimuFlow vous aide à vérifier un process avant de le mettre en place : vous le voyez s'animer, étape par étape, et l'app vous signale ce qui cloche. Elle marche sur iPhone, sur Android et [dans le navigateur](https://mloick.github.io/SIMUFLOW/app/). Tous les exemples sont fictifs.

Chaque fonctionnalité porte son état : **Disponible** ou **Prévue**. Sous certaines captures, **Plus de captures** déplie les autres écrans.

**Sommaire**

1. [Ajouter un process](#1-ajouter-un-process) : fichier, tableau Excel, photo
2. [Voir et corriger](#2-voir-et-corriger) : liste, diagnostic, éditeur
3. [Simuler et partager](#3-simuler-et-partager) : pas à pas, tous les cas, export, anonymisation
4. [Suivre une vraie demande](#4-suivre-une-vraie-demande) : échéances et rappels
5. [Formulaires de demande](#5-formulaires-de-demande) : voir, remplir et relier un formulaire à son workflow
6. [Compte et données](#6-compte-et-données) : synchronisation, version web, confidentialité
7. [Confort](#7-confort) : mode sombre, grands textes, présentation
8. [Prévu](#8-prévu)

## 1. Ajouter un process

### Depuis un fichier · Disponible

Touchez **+** dans la liste, choisissez **draw.io**, **BPMN**, **Visio** ou **JSON**, puis le fichier. L'app montre ce qu'elle a lu (étapes, acteurs, problèmes, ce qu'elle a dû deviner) ; touchez **Importer**, ou **Importer et corriger** pour ouvrir l'éditeur tout de suite.

Le schéma n'a pas besoin d'un style particulier : l'app suit les flèches. Une étape d'où partent plusieurs flèches nommées est une décision, même dessinée en rectangle. Les acteurs viennent des couloirs, d'une légende de couleurs ou du texte des étapes (« Responsable : Comptabilité ») ; l'app garde le service plutôt que le nom des personnes. Un fichier BPMN (Camunda, bpmn.io, Bizagi, Signavio…) ou Visio (`.vsdx`) garde sa mise en page. Pour en savoir plus : [BPMN 2.0 en bref](bpmn.md).

Vos process importés restent sur le téléphone, et sur votre compte si vous êtes connecté. Pour en retirer un : **Supprimer ce process**, en bas de sa fiche.

![Importer un fichier : aperçu, fichier refusé, process importé](captures/etape-5b-import.png)

<details>
<summary>Plus de captures</summary>

![Import BPMN : l'aperçu de l'exemple, puis tous ses chemins dans la simulation](captures/etape-29-import-bpmn.png)

![Import Visio : la carte « Fichier Visio » et l'aperçu de l'exemple, puis ses deux chemins dans la simulation](captures/etape-30-import-visio.png)

![Un schéma sans couleur ni losange : la décision, le départ et les acteurs sont trouvés](captures/etape-L1-lecture-indices.png)

![Un schéma dont les acteurs sont donnés par une légende de couleurs](captures/etape-9-acteurs-legende.png)

![Un process importé retrouvé après redémarrage, et le bouton pour le supprimer](captures/etape-5c-garder.png)

</details>

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

L'onglet **Scanner** ouvre l'appareil photo. Cadrez un tableau (une ligne par étape, avec l'acteur et le délai) et prenez la photo. L'app recadre la feuille, lit le texte **sur le téléphone, sans Internet**, ne garde que le tableau et ignore le texte autour. Touchez **Créer le process** : chaque ligne devient une étape ; une colonne **Suite** (« oui → 3 ; non → 4 ») crée les décisions. **Créer et corriger** ouvre aussi l'éditeur.

Dans le navigateur, **Prendre ou choisir une photo** ouvre l'appareil photo ou une image (une capture d'écran marche aussi). La lecture se fait dans le navigateur, un peu moins finement. Pour essayer : `docs/exemples/tableaux-a-scanner.html`, six tableaux à afficher ou imprimer.

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

L'écran **Process** liste vos process, avec le nombre d'étapes, de décisions et d'acteurs, et une pastille : vert sans anomalie, orange pour des avertissements, rouge pour des erreurs. La recherche ignore les accents. Dessous, la section **Exemples** propose quatre process fictifs pour essayer ; coupez **Afficher les exemples** dans **Profil** pour les masquer.

![La liste sans process à vous, puis avec vos process et les exemples repliés, et le réglage du Profil](captures/etape-13b-exemples.png)

<details>
<summary>Plus de captures</summary>

![La liste des process et ses différents états](captures/etape-4a-liste.png)

</details>

### Voir les problèmes · Disponible

La fiche d'un process donne ses chiffres clés (étapes, décisions, chemins possibles), ses acteurs et son **diagnostic**, les plus graves en premier : départ ou fin manquant, impasse, chemin qui ne peut jamais finir, étape inatteignable, décision à une seule sortie, branche sans nom. **Voir** descend jusqu'à l'étape concernée et la surligne. Le bouton de partage envoie un résumé.

![La fiche d'un process](captures/etape-4b-detail.png)

### Corriger un process · Disponible

Touchez **Modifier le process**, puis une étape : changez son titre, son rôle (départ, tâche, décision, fin), son acteur, son délai et le nom de ses branches. Vous pouvez aussi **ajouter une étape après**, **ajouter un cas** à une décision, **relier à une autre étape** ou **supprimer l'étape**. Le nombre de points à corriger se met à jour en direct. La fiche garde la trace : « Corrigé dans l'app le … ».

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

Le déroulé montre chaque étape, son acteur et le délai cumulé en jours ouvrés. Au-dessus, le **schéma se construit** au fil du parcours et se recadre seul ; pincez pour zoomer, **Tout** montre le schéma entier.

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

Dans la simulation, le bouton de partage propose :

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

## 4. Suivre une vraie demande

### Suivi en vrai · Disponible

Sur la fiche, **Suivre une demande** démarre un suivi. Chaque étape reçoit son échéance en **jours ouvrés** (du lundi au vendredi, de 9 h à 17 h, sans les jours fériés). Touchez **Étape terminée**, ou choisissez la branche à une décision. Une pastille dit si l'étape est **à l'heure**, **proche de l'échéance** ou **en retard**.

![Suivi en vrai : les demandes d'un process, une demande en cours, puis l'étape suivante](captures/etape-11b-suivi.png)

### Rappels d'échéance · Disponible

Dans **Profil**, activez **Rappels d'échéance**. Le téléphone vous prévient **le matin du jour de l'échéance**, puis **à l'échéance** si l'étape n'est pas finie ; toucher le rappel ouvre la demande. Tout est programmé sur le téléphone, sans serveur. **Envoyer une notification d'essai** en envoie une 5 secondes plus tard.

![Profil : la section Notifications, en clair et en sombre](captures/etape-11a-notifications.png)

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

Dans **Profil**, **Se connecter ou créer un compte**. Le mot de passe demande au moins 8 caractères, avec minuscule, majuscule, chiffre et symbole ; l'app dit ce qui manque. **Mot de passe oublié ?** envoie un lien valable une heure, qui rouvre l'app sur **Nouveau mot de passe**. La connexion est gardée dans le coffre chiffré du téléphone.

Connecté, vos process, règles de lecture et formulaires gardés vous suivent sur tous vos appareils. Sans réseau, rien n'est perdu : la liste affiche « Hors connexion » et l'app envoie les changements dès le retour du réseau. **Supprimer mon compte** efface le compte et ses données, sur le serveur et sur le téléphone. Le serveur est hébergé à Paris ; **À propos** dit s'il est joignable.

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

Les corrections qui ne touchent pas aux fonctions du téléphone arrivent toutes seules, au lancement suivant. La ligne de version, en bas du **Profil**, indique la dernière mise à jour reçue.

![La version de l'app en bas du Profil](captures/etape-9-version.png)

## 7. Confort

- **Mode sombre** · Disponible : l'app suit le réglage du téléphone.
- **Grands textes** · Disponible : si vous agrandissez le texte du téléphone, l'app suit et réorganise ce qui ne tient plus côte à côte.
- **Animations douces** · Disponible : la liste « respire » pendant le chargement ; rien ne bouge si « Réduire les animations » est activé.
- **Présentation au premier lancement** · Disponible : quatre pages, à revoir depuis **Profil**.
- **Icône et écran de démarrage** · Disponible : le logo en S, en clair ou en sombre.
- **Profil** · Disponible : compte, notifications, exemples, règles apprises, puis **À propos** (serveur, présentation, confidentialité, version).

![Texte agrandi : le détail d'un process et la simulation](captures/etape-13d-grands-textes.png)

<details>
<summary>Plus de captures</summary>

![La présentation : bienvenue, ajouter ses process, suivre une vraie demande, et le lien dans le Profil](captures/etape-13c-bienvenue.png)

![L'icône sur iOS et Android, et l'écran de démarrage en mode clair et sombre](captures/etape-9-identite.png)

![Le Profil : le compte et les réglages, puis la section À propos](captures/etape-13d-profil.png)

</details>

## 8. Prévu

- **Partager et valider** · Prévue : partager un process avec des collègues, et être prévenu quand quelqu'un valide ou commente une étape.
- **Voir sur le schéma** · Prévue : le bouton « Voir » d'une anomalie montrera aussi l'endroit exact sur le schéma.
- **Interface en anglais** · Prévue.
- **VoiceOver et TalkBack** · Prévue : une lecture complète par les lecteurs d'écran.
