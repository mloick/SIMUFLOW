<p align="center"><img src="docs/logo/simuflow-logo.svg" width="320" alt="SimuFlow"></p>

# SimuFlow

Français · [English](README.md)

SimuFlow est une application mobile qui transforme un workflow métier en un parcours interactif et vérifié. On importe un schéma draw.io ou on photographie un tableau de process, on voit les anomalies, puis on rejoue le process pas à pas en choisissant chaque branche.

> État : début du projet. Tous les écrans existent et sont reliés entre eux (onglets Process, Scanner, Profil ; détail, simulation, import, connexion), mais seuls la liste, le détail des process, l'écran d'import, la simulation, la connexion et le Scanner (photo, puis lecture sur le téléphone par un module natif, en Swift avec Vision sur iPhone, qui recadre aussi la photo sur le document, et en Kotlin avec ML Kit sur Android, et seul le tableau est gardé, repéré par sa ligne de titres, puis transformé en process avec ses décisions, acteurs et délais) sont construits pour l'instant : une courte présentation en quatre pages s'ouvre au premier lancement (à revoir depuis le Profil) ; ils montrent vos process avec leur diagnostic, puis des process d'exemple dans une section repliable (masquable depuis le Profil), on peut ajouter les siens depuis un fichier draw.io ou JSON (enregistrés sur le téléphone, supprimables, et corrigeables dans un éditeur : étapes, cas de décision et branches se modifient, s’ajoutent ou se retirent ; l’app apprend des règles de lecture de ces corrections, les garde sur votre compte et les réapplique aux imports suivants), rejouer chaque process pas à pas pendant que son schéma se construit à l'écran, voir tous les cas d'un coup, une couleur par famille de chemins, exporter le schéma en PDF, en fichier draw.io ou en JSON, suivre une vraie demande étape par étape avec ses échéances en jours ouvrés (week-ends et jours fériés exclus), et créer un compte (connexion, déconnexion, mot de passe oublié avec un lien reçu par e-mail, suppression) qui garde vos process importés synchronisés entre vos appareils. Les autres écrans sont encore provisoires. Les fonctionnalités du simulateur sont construites étape par étape, d'après la maquette.

## Pour qui

Les chefs de projet et analystes qui conçoivent des workflows de gestion des services informatiques (ITSM) avec les métiers. Un schéma statique se valide mal : impasses, décisions à une seule sortie et délais incohérents sont découverts trop tard. SimuFlow les rend visibles en moins d'une minute.

## Écrans clés

- **Process** : la liste des process importés, avec leur état de diagnostic.
- **Simulation** : le schéma s'allume au fil du parcours ; chaque décision demande quelle branche suivre. La vue « Tous » montre tous les chemins, une couleur par famille, avec le chemin critique. Le schéma s'exporte en PDF, en fichier draw.io ou en JSON.
- **Scanner** : on photographie un tableau (étape, acteur, délai) et il devient un workflow.
- **Profil** : le compte et la synchronisation, les rappels d'échéance, le réglage des exemples, les règles de lecture apprises, et une section « À propos » (état du serveur, revoir la présentation, version de l'app).

La maquette complète est dans [`docs/maquette/`](docs/maquette/).

## Logo

Le logo est un chemin en S : un point de départ, deux virages, une flèche d'arrivée. Il représente un process que l'on parcourt pas à pas, et forme le S de SimuFlow. Son histoire, ses couleurs et ses fichiers sont dans [`docs/logo/`](docs/logo/). C'est aussi l'icône de l'app et son écran de démarrage.

## Fonctionnalités du téléphone

- Caméra avec lecture de texte sur le téléphone (module natif en Kotlin et en Swift).
- Notifications locales (sans serveur) : rappels d'échéance de chaque étape d'un process suivi en vrai : le matin du jour de l'échéance, puis à l'échéance si elle est dépassée ; toucher un rappel ouvre la demande. L'interrupteur et une notification d'essai sont dans l'onglet Profil.

## Démarrer

Prérequis : un Mac avec Xcode, et Node.js 22.13 ou plus récent.

```bash
npm install
npx expo run:ios
```

L'app est compilée avec Xcode (build de développement) et s'ouvre dans le Simulateur iOS. Pour l'installer sur un iPhone branché en USB : `npx expo run:ios --device`. Le dossier `ios/` est généré automatiquement et n'est pas versionné.

`npm run ios:simulateur` et `npm run ios:iphone` font la même chose, après avoir vérifié que les versions des paquets correspondent au SDK Expo (corriger avec `npx expo install --fix`, puis `cd ios && pod install`). Les fichiers de compilation sont gardés : la compilation suivante ne refait que ce qui a changé. `npm run nettoyer` les efface pour libérer de l'espace disque (la compilation suivante repart alors de zéro) ; les scripts le rappellent quand il reste moins de 10 Go.

Une nouvelle compilation n'est utile que si l'on ajoute un module natif. Sinon, une fois l'app installée, `npx expo start` puis ouvrir l'app : les modifications arrivent en quelques secondes.

**Build installable (sans Mac).** EAS Build compile l'app sur les serveurs d'Expo. `npx eas-cli@latest build --platform android --profile preview` produit un APK Android qui s'installe depuis un lien ou un QR code et fonctionne sans serveur de développement. Installer un build EAS sur un iPhone demande un compte Apple Developer payant ; avec un compte gratuit, utiliser le build de développement Xcode ci-dessus. Une fois l'app installée, les changements de JavaScript lui arrivent sans nouveau build grâce à EAS Update : `npx eas-cli@latest update --channel preview --message "..."`. Détails dans `docs/technique.md`.

Les fichiers sensibles (`.env`, clés, certificats) et les fichiers locaux de Claude Code (`.claude/`) sont exclus du dépôt par le `.gitignore`.

## Documentation

- [Documentation technique](docs/technique.md) : architecture, structure, commandes.
- [Guide des fonctionnalités](docs/fonctionnalites.md) : ce que fait l'application, en termes simples.
- [Sécurité](docs/securite.md) : clés, règles d'accès, comptes, données sur le téléphone.
- [Travailler avec l'IA](docs/ia.md) : ce qui guide l'IA (AGENTS.md, CLAUDE.md, MCP) et comment nous travaillons avec.

## Technologies

Expo SDK 58, React Native 0.88, Expo Router, TypeScript (strict), backend Supabase (`@supabase/supabase-js`). Le cœur du simulateur (`src/domain/`) est en TypeScript pur, testé avec Jest, et les composants principaux avec React Native Testing Library : `npm test`. Un test de bout en bout (Maestro, `.maestro/`) simule un process pas à pas dans la vraie app, sur le Simulateur iOS : `npm run e2e`. À chaque pull request et à chaque push sur `main`, GitHub Actions vérifie les types, l'analyse du code et les tests (`.github/workflows/verifications.yml`).

## Licence

Voir [LICENSE](LICENSE).
