# Documentation technique

Ce document décrit le code tel qu'il est aujourd'hui, puis l'architecture visée. Il est mis à jour à chaque modification du code (voir « Mise à jour de la documentation » en bas).

## État actuel

Le squelette de navigation est en place : tous les écrans de la maquette existent et sont reliés entre eux. Le cœur du simulateur (`src/domain/`) est codé et testé : types d'un process, diagnostic des anomalies et calcul des chemins. Les écrans Liste des process et Détail d'un process suivent la maquette et affichent des process fictifs, avec leur diagnostic ; les autres écrans n'affichent encore qu'un titre, une description et des liens.

| Élément | Version |
| --- | --- |
| Expo SDK | 58 |
| React Native | 0.88 |
| React | 19.3 |
| Expo Router | 58 (routes dans `src/app/`) |
| TypeScript | 6.0, mode `strict` |
| Jest | 30, préréglage `jest-expo` |

## Structure du dépôt

```text
src/
  app/          Écrans et navigation (Expo Router : un fichier = une route)
  components/   Composants réutilisables (texte et vue thémés, carte de process, pastille, bouton, squelette de chargement, message d'état, écran provisoire)
  constants/    Thème : couleurs, espacements, polices
  data/         Accès aux process : process fictifs et chargement simulé, en attendant le backend
  domain/       Cœur du simulateur en TypeScript pur : types, diagnostic, chemins, exemple fictif ; tests dans __tests__/
  hooks/        Hooks partagés (thème, mode sombre)
  utils/        Petites fonctions de texte (pluriel, recherche sans accents)
assets/         Icônes, images, écran de démarrage
docs/           Documentation, maquette des écrans (maquette/), logo (logo/) et captures de chaque étape (captures/)
scripts/        Lancement iOS avec nettoyage (ios.sh, nettoyer-ios.sh), script du modèle Expo (reset-project)
app.json        Configuration Expo (nom, icônes, plugins)
```

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npx expo run:ios` | Compiler l'app avec Xcode (build de développement) et l'ouvrir dans le Simulateur iOS |
| `npx expo run:ios --device` | Installer le build de développement sur un iPhone branché en USB |
| `npm run ios:simulateur` | Comme `npx expo run:ios`, puis efface les fichiers temporaires de compilation à l'arrêt (Ctrl+C) |
| `npm run ios:iphone` | Comme `npx expo run:ios --device`, avec le même nettoyage à l'arrêt |
| `npm run nettoyer` | Effacer seulement les fichiers temporaires de compilation iOS |
| `npx expo start` | Relancer le serveur de développement quand le build est déjà installé |
| `npm test` | Lancer les tests unitaires (Jest) |
| `npx tsc --noEmit` | Vérifier les types |
| `npx expo lint` | Analyser le code (ESLint) |
| `npx expo install <paquet>` | Ajouter une dépendance compatible avec le SDK |

Avant le premier `npx tsc --noEmit`, lancer une fois `npx expo start` : il génère `expo-env.d.ts` et les types des routes (`.expo/types/`), qui ne sont pas versionnés.

## Thème

Les couleurs viennent de la maquette et sont rangées dans `src/constants/theme.ts` :

- `Brand` : les deux couleurs du logo, bleu `#007ec5` et marine `#0b2540`.
- `Colors.light` et `Colors.dark` : la même liste de couleurs nommées par leur rôle (`background`, `surface`, `surfaceMuted`, `field`, `text`, `textSecondary`, `link`, `primary`, `onPrimary`, `primaryBackground`, `border`, et les couleurs du diagnostic `success`, `warning`, `danger` avec leur fond).
- `Radius` (arrondis), `Spacing` (espacements), `Fonts` (polices système).

Le hook `useTheme()` (`src/hooks/use-theme.ts`) renvoie la palette du mode actif du téléphone, clair ou sombre. `ThemedText` et `ThemedView` l'utilisent, ainsi que la barre d'onglets et les en-têtes de navigation (thème construit dans `src/app/_layout.tsx`). Un écran ne doit jamais écrire une couleur en dur : il prend `useTheme().text`, `useTheme().surface`, etc.

Chaque couleur de texte respecte un contraste d'au moins 4,5:1 sur son fond (règle WCAG AA). C'est pourquoi `primary` en mode clair (`#0078bd`) est un peu plus foncé que le bleu du logo : le texte blanc des boutons reste lisible.

## Cœur du simulateur

`src/domain/` ne dépend ni de React Native ni du format d'import : ce sont des fonctions TypeScript qui prennent un process et renvoient un résultat. Les règles sont reprises du prototype web (dossier de référence).

**Modèle** (`types.ts`). Un `Process` est un graphe : des `Step` (étapes) reliées par des `Link` (liens orientés). Une étape a un rôle (`start`, `task`, `decision`, `end`), un titre, un acteur et un délai en jours ouvrés, tous deux facultatifs. Un lien peut porter un libellé (« oui », « non »).

**Index** (`graph.ts`). `buildGraph` range les liens sortants et entrants de chaque étape et repère les départs et les fins. Sans étape `start`, les départs sont les étapes où rien n'arrive mais d'où un lien part. Deux parcours en largeur servent au diagnostic : les étapes atteignables depuis un départ, et celles d'où l'on peut atteindre une fin (parcours à rebours).

**Diagnostic** (`diagnostic.ts`). `diagnose` renvoie la liste des anomalies, triées de la plus grave à la moins grave. `describeIssue` donne le message en français.

| Code | Gravité | Signification |
| --- | --- | --- |
| `no-start` | erreur | aucun point de départ |
| `no-end` | erreur | aucune étape de fin |
| `decision-single-exit` | erreur | décision avec une seule sortie |
| `dead-end` | avertissement | impasse : étape sans suite qui n'est pas une fin |
| `cannot-finish` | avertissement | aucune fin atteignable (boucle sans sortie) |
| `unreachable` | avertissement | étape jamais atteinte depuis le départ |
| `unlabeled-branch` | avertissement | branche de décision sans libellé |
| `duplicate-label` | avertissement | deux branches au même libellé |
| `isolated-step` | avertissement | étape reliée à aucune autre |
| `empty-title` | avertissement | étape sans titre |
| `dangling-link` | avertissement | lien vers une étape qui n'existe pas |
| `multiple-starts` | info | plusieurs départs : la simulation demandera lequel prendre |
| `ambiguous-exits` | info | plusieurs sorties sans libellé hors décision : choix ou parallèle ? |

**Chemins** (`paths.ts`). Un chemin va d'un départ à une étape terminale (une fin, ou une étape sans suite) ; son délai est la somme des délais de ses étapes.

- `shortestPath` (cas simple) : parcours en largeur, qui trouve la fin la plus proche en nombre d'étapes.
- `longestPath` (cas complexe) : parcours en profondeur de tous les chemins sans repasser par une même étape, en gardant le plus long.
- `countPaths` : nombre de chemins sans boucle, plafonné à 2 000.

Les parcours en profondeur s'arrêtent après 300 000 visites, pour qu'un gros schéma plein de boucles ne bloque pas le téléphone.

**Tests** (`__tests__/`). Jest, avec le préréglage `jest-expo`. Les tests partent d'un process fictif, la demande de matériel de bureau (`exemples.ts`), et y créent chaque anomalie une par une.

## Navigation

Expo Router associe chaque fichier de `src/app/` à un écran.

| Fichier | Route | Écran |
| --- | --- | --- |
| `_layout.tsx` | | Pile de navigation principale (thème clair ou sombre, écran de démarrage) |
| `(tabs)/_layout.tsx` | | Barre d'onglets native : Process, Scanner, Profil |
| `(tabs)/index.tsx` | `/` | Liste des process |
| `(tabs)/scanner.tsx` | `/scanner` | Scanner de tableau |
| `(tabs)/profil.tsx` | `/profil` | Profil et compte |
| `process/[id].tsx` | `/process/:id` | Détail d'un process |
| `simulation/[id].tsx` | `/simulation/:id` | Simulation pas à pas |
| `import.tsx` | `/import` | Import d'un process (fenêtre modale) |
| `connexion.tsx` | `/connexion` | Connexion (fenêtre modale) |

Sauf la liste et le détail des process, les écrans utilisent pour l'instant `PlaceholderScreen` (`src/components/placeholder-screen.tsx`) : un titre, une description et des liens. Ils seront remplacés un par un par les écrans de la maquette. Les routes sont typées (`typedRoutes`) : un lien vers un écran qui n'existe pas est signalé par TypeScript. Les onglets utilisent les icônes système (SF Symbols sur iOS, Material Symbols sur Android). L'app vise iOS et Android ; la version web n'est pas prise en charge.

## Écran Liste des process

`src/app/(tabs)/index.tsx` reprend l'écran 2 de la maquette : titre, champ de recherche, une carte par process et un bouton « + » qui ouvre l'import. Chaque carte (`process-card.tsx`) affiche le nombre d'étapes, de décisions et d'acteurs, une pastille de diagnostic (erreurs d'abord, puis avertissements, sinon « Aucune anomalie ») et la source (draw.io ou Scan). Ces chiffres viennent de `summarize` (`src/domain/summary.ts`), qui appelle le diagnostic. Toute la carte ouvre le détail.

**Données.** `useProcessList()` (`src/data/process-store.ts`) charge les quatre process fictifs de `demo-processes.ts` après un délai simulé de 0,7 s. Deux d'entre eux contiennent des anomalies exprès. Le backend remplacera `fetchProcesses` sans toucher à l'écran.

**Les 5 états** (maquette, écran 10) :

| État | Affichage |
| --- | --- |
| Chargement | Squelette de la forme des cartes, sans spinner (`list-skeleton.tsx`) |
| Vide | Message et bouton « Ajouter un process » (`state-message.tsx`) |
| Erreur | Message et bouton « Réessayer », qui relance le chargement |
| Hors connexion | Bandeau orange au-dessus de la dernière version enregistrée |
| Contenu | Les cartes ; si la recherche ne trouve rien, une phrase le dit |

En mode développement, l'onglet Profil propose « Démo · état de la liste des process » pour forcer chacun de ces états. Le choix est gardé en mémoire avec `useSyncExternalStore` et n'existe pas dans l'app publiée (`__DEV__`).

**Recherche.** Elle ignore les accents et les majuscules (`normalizeForSearch`, `src/utils/format.ts`) : « materiel » trouve « Commande de matériel ».

![Écran Liste : chargement, contenu, vide, erreur, hors connexion, et l'onglet Profil avec le choix de l'état de démo](captures/etape-4a-liste.png)

**Accessibilité.** Chaque carte est un bouton dont VoiceOver et TalkBack lisent tout le contenu en une phrase. Le champ de recherche et le bouton « + » ont un libellé. Le squelette est annoncé « Chargement des process », le bandeau hors connexion comme une alerte. Les zones à toucher font au moins 44 points.

## Écran Détail d'un process

`src/app/process/[id].tsx` reprend l'écran 3 de la maquette. Il lit le process avec `getProcess(id)` (`src/data/process-store.ts`) ; un identifiant inconnu affiche « Process introuvable » avec un bouton de retour.

- **En-tête** : retour « Process » et bouton de partage (`Share` de React Native, qui envoie un résumé en texte).
- **Chiffres** : étapes, décisions, chemins possibles (`countPaths`, affiché « 2000+ » au-delà du plafond) et points à corriger (erreurs + avertissements). Cette dernière tuile est rouge s'il y a une erreur, orange s'il n'y a que des avertissements, verte sinon.
- **Acteurs** : une pastille par acteur distinct.
- **Diagnostic** : erreurs et avertissements, avec un titre court et une phrase qui nomme l'étape (`explainIssue`, `src/domain/diagnostic.ts`). Les informations sont repliées sous « N informations repliées ».
- **Étapes** : la liste dans l'ordre du process, avec rôle, acteur et délai. « Voir » fait défiler jusqu'à l'étape concernée et la surligne : chaque ligne mémorise sa position (`onLayout`), puis `scrollTo` y descend.
- **Bouton « Lancer la simulation »**, fixé en bas, qui ouvre `/simulation/[id]`.

![Écran Détail : process avec avertissements en clair et en sombre, process sans anomalie, process introuvable](captures/etape-4b-detail.png)

**Accessibilité.** Chaque tuile, anomalie et étape est lue d'un bloc. « Voir » annonce l'anomalie qu'il montre (« Voir l'étape : Impasse »). Le repli des informations annonce s'il est ouvert ou fermé.

## Build de développement

L'app se teste avec un build de développement compilé par Xcode, et non avec Expo Go : le futur module natif de lecture de texte (Kotlin et Swift) ne peut pas tourner dans Expo Go. `npx expo run:ios` génère le dossier `ios/` (génération native continue), le compile et lance l'app. Les dossiers `ios/` et `android/` ne sont pas versionnés : la configuration native passe par `app.json` et les plugins de configuration.

### Nettoyage après compilation

Une compilation Xcode laisse plusieurs Go de fichiers intermédiaires. `scripts/ios.sh` lance `npx expo run:ios` (avec les options passées, par exemple `--device`) et, quand le serveur s'arrête, appelle `scripts/nettoyer-ios.sh`. Ce script, qui ne fait rien hors de macOS, supprime :

- `~/Library/Developer/Xcode/DerivedData/SimuFlow-*` : les fichiers compilés par Xcode pour ce projet ;
- `ios/build` ;
- les caches Metro dans le dossier temporaire (`metro-*`, `haste-map-*`) ;
- les simulateurs iOS devenus inutilisables (`xcrun simctl delete unavailable`).

Il affiche ensuite l'espace libéré. Le dossier `ios/` et ses `Pods` sont gardés : `ios/` contient la signature (équipe Apple choisie dans Xcode), et garder les `Pods` évite de les retélécharger. Contrepartie : la compilation suivante repart de zéro et prend quelques minutes de plus.

## Fichiers exclus du dépôt

Le `.gitignore` exclut, en plus des fichiers générés :

- les secrets : `.env` et ses variantes (sauf `.env.example`), clés et certificats (`*.key`, `*.p8`, `*.p12`, `*.pem`, `*.jks`, `*.keystore`, `*.mobileprovision`), `credentials.json`, `google-services.json`, `GoogleService-Info.plist` ;
- l'état local de Claude Code : le dossier `.claude/` et `CLAUDE.local.md`. `CLAUDE.md` et `AGENTS.md` restent versionnés, car ils portent les règles du projet.

## Architecture visée

Le cœur du simulateur ne dépend pas de l'écran : il est écrit en TypeScript pur et testé séparément (voir « Cœur du simulateur »).

| Dossier prévu | Rôle |
| --- | --- |
| `src/domain/` | Types du process, règles du diagnostic, calcul des chemins (fait) |
| `src/import/` | Lecture des fichiers draw.io et JSON, et des tableaux scannés |
| `src/simulation/` | Moteur de simulation : `step(état, choix)` renvoie le nouvel état |
| `modules/` | Module natif de lecture de texte (Kotlin pour Android, Swift pour iOS) |

Backend prévu : Supabase (comptes, process partagés, statuts de validation).

## Mise à jour de la documentation

Les fichiers `README.md`, `README.fr.md`, `docs/technique.md` et `docs/fonctionnalites.md` sont tenus à jour de deux façons :

1. **Règle `CLAUDE.md`** : quand Claude modifie le code, il met ces documents à jour dans la même pull request.
2. **Robot GitHub** (`.github/workflows/documentation.yml`) : à chaque push qui touche le code, Claude relit les changements et met la documentation à jour sur la même branche. Il a besoin du secret `CLAUDE_CODE_OAUTH_TOKEN` dans les réglages du dépôt.
