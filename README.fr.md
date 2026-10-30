<p align="center"><img src="docs/logo/simuflow-logo.svg" width="320" alt="SimuFlow"></p>

# SimuFlow

Français · [English](README.md)

SimuFlow est une application mobile qui transforme un workflow métier en un parcours interactif et vérifié. On importe un schéma draw.io ou on photographie un tableau de process, on voit les anomalies, puis on rejoue le process pas à pas en choisissant chaque branche.

> État : début du projet. Tous les écrans existent et sont reliés entre eux (onglets Process, Scanner, Profil ; détail, simulation, import, connexion), mais seuls la liste, le détail des process, l'écran d'import et la simulation sont construits pour l'instant : ils montrent des process d'exemple avec leur diagnostic, on peut ajouter les siens depuis un fichier draw.io ou JSON (enregistrés sur le téléphone, et supprimables), rejouer chaque process pas à pas pendant que son schéma se construit à l'écran, voir tous les cas d'un coup, une couleur par famille de chemins, et exporter le schéma en PDF, en fichier draw.io ou en JSON. Les autres écrans sont encore provisoires. Les fonctionnalités du simulateur sont construites étape par étape, d'après la maquette.

## Pour qui

Les chefs de projet et analystes qui conçoivent des workflows de gestion des services informatiques (ITSM) avec les métiers. Un schéma statique se valide mal : impasses, décisions à une seule sortie et délais incohérents sont découverts trop tard. SimuFlow les rend visibles en moins d'une minute.

## Écrans clés

- **Process** : la liste des process importés, avec leur état de diagnostic.
- **Simulation** : le schéma s'allume au fil du parcours ; chaque décision demande quelle branche suivre. La vue « Tous » montre tous les chemins, une couleur par famille, avec le chemin critique. Le schéma s'exporte en PDF, en fichier draw.io ou en JSON.
- **Scanner** : on photographie un tableau (étape, acteur, délai) et il devient un workflow.

La maquette complète est dans [`docs/maquette/`](docs/maquette/).

## Logo

Le logo est un chemin en S : un point de départ, deux virages, une flèche d'arrivée. Il représente un process que l'on parcourt pas à pas, et forme le S de SimuFlow. Son histoire, ses couleurs et ses fichiers sont dans [`docs/logo/`](docs/logo/).

## Fonctionnalités du téléphone

- Caméra avec lecture de texte sur le téléphone (module natif en Kotlin et en Swift).
- Notifications quand un process partagé est validé ou commenté.

## Démarrer

Prérequis : un Mac avec Xcode, et Node.js 22.13 ou plus récent.

```bash
npm install
npx expo run:ios
```

L'app est compilée avec Xcode (build de développement) et s'ouvre dans le Simulateur iOS. Pour l'installer sur un iPhone branché en USB : `npx expo run:ios --device`. Le dossier `ios/` est généré automatiquement et n'est pas versionné.

`npm run ios:simulateur` et `npm run ios:iphone` font la même chose, après avoir vérifié que les versions des paquets correspondent au SDK Expo (corriger avec `npx expo install --fix`, puis `cd ios && pod install`). Les fichiers de compilation sont gardés : la compilation suivante ne refait que ce qui a changé. `npm run nettoyer` les efface pour libérer de l'espace disque (la compilation suivante repart alors de zéro) ; les scripts le rappellent quand il reste moins de 10 Go.

Une nouvelle compilation n'est utile que si l'on ajoute un module natif. Sinon, une fois l'app installée, `npx expo start` puis ouvrir l'app : les modifications arrivent en quelques secondes.

Les fichiers sensibles (`.env`, clés, certificats) et les fichiers locaux de Claude Code (`.claude/`) sont exclus du dépôt par le `.gitignore`.

## Documentation

- [Documentation technique](docs/technique.md) : architecture, structure, commandes.
- [Guide des fonctionnalités](docs/fonctionnalites.md) : ce que fait l'application, en termes simples.

## Technologies

Expo SDK 58, React Native 0.88, Expo Router, TypeScript (strict), backend Supabase (`@supabase/supabase-js`). Le cœur du simulateur (`src/domain/`) est en TypeScript pur, testé avec Jest : `npm test`.

## Licence

Voir [LICENSE](LICENSE).
