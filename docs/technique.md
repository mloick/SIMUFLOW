# Documentation technique

Ce document décrit le code tel qu'il est aujourd'hui, puis l'architecture visée. Il est mis à jour à chaque modification du code (voir « Mise à jour de la documentation » en bas).

## État actuel

Le squelette de navigation est en place : tous les écrans de la maquette existent et sont reliés entre eux, mais chacun n'affiche encore qu'un titre, une phrase qui décrit son rôle et des liens vers les écrans suivants. Aucune donnée ni logique du simulateur n'est encore codée.

| Élément | Version |
| --- | --- |
| Expo SDK | 58 |
| React Native | 0.88 |
| React | 19.3 |
| Expo Router | 58 (routes dans `src/app/`) |
| TypeScript | 6.0, mode `strict` |

## Structure du dépôt

```text
src/
  app/          Écrans et navigation (Expo Router : un fichier = une route)
  components/   Composants réutilisables (texte et vue thémés, écran provisoire)
  constants/    Thème : couleurs, espacements, polices
  hooks/        Hooks partagés (thème, mode sombre)
assets/         Icônes, images, écran de démarrage
docs/           Documentation et maquette des écrans
scripts/        Script du modèle Expo (reset-project)
app.json        Configuration Expo (nom, icônes, plugins)
```

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm install` | Installer les dépendances |
| `npx expo run:ios` | Compiler l'app avec Xcode (build de développement) et l'ouvrir dans le Simulateur iOS |
| `npx expo run:ios --device` | Installer le build de développement sur un iPhone branché en USB |
| `npx expo start` | Relancer le serveur de développement quand le build est déjà installé |
| `npx tsc --noEmit` | Vérifier les types |
| `npx expo lint` | Analyser le code (ESLint) |
| `npx expo install <paquet>` | Ajouter une dépendance compatible avec le SDK |

Avant le premier `npx tsc --noEmit`, lancer une fois `npx expo start` : il génère `expo-env.d.ts` et les types des routes (`.expo/types/`), qui ne sont pas versionnés.

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

Les écrans utilisent pour l'instant `PlaceholderScreen` (`src/components/placeholder-screen.tsx`) : un titre, une description et des liens. Ils seront remplacés un par un par les écrans de la maquette. Les routes sont typées (`typedRoutes`) : un lien vers un écran qui n'existe pas est signalé par TypeScript. Les onglets utilisent les icônes système (SF Symbols sur iOS, Material Symbols sur Android). L'app vise iOS et Android ; la version web n'est pas prise en charge.

## Build de développement

L'app se teste avec un build de développement compilé par Xcode, et non avec Expo Go : le futur module natif de lecture de texte (Kotlin et Swift) ne peut pas tourner dans Expo Go. `npx expo run:ios` génère le dossier `ios/` (génération native continue), le compile et lance l'app. Les dossiers `ios/` et `android/` ne sont pas versionnés : la configuration native passe par `app.json` et les plugins de configuration.

## Fichiers exclus du dépôt

Le `.gitignore` exclut, en plus des fichiers générés :

- les secrets : `.env` et ses variantes (sauf `.env.example`), clés et certificats (`*.key`, `*.p8`, `*.p12`, `*.pem`, `*.jks`, `*.keystore`, `*.mobileprovision`), `credentials.json`, `google-services.json`, `GoogleService-Info.plist` ;
- l'état local de Claude Code : le dossier `.claude/` et `CLAUDE.local.md`. `CLAUDE.md` et `AGENTS.md` restent versionnés, car ils portent les règles du projet.

## Architecture visée

Le cœur du simulateur ne dépend pas de l'écran : il sera écrit en TypeScript pur et testé séparément, à partir du prototype web existant.

| Dossier prévu | Rôle |
| --- | --- |
| `src/domain/` | Types du workflow, règles du diagnostic, calcul des chemins |
| `src/import/` | Lecture des fichiers draw.io et JSON, et des tableaux scannés |
| `src/simulation/` | Moteur de simulation : `step(état, choix)` renvoie le nouvel état |
| `modules/` | Module natif de lecture de texte (Kotlin pour Android, Swift pour iOS) |

Backend prévu : Supabase (comptes, process partagés, statuts de validation).

## Mise à jour de la documentation

Les fichiers `README.md`, `README.fr.md`, `docs/technique.md` et `docs/fonctionnalites.md` sont tenus à jour de deux façons :

1. **Règle `CLAUDE.md`** : quand Claude modifie le code, il met ces documents à jour dans la même pull request.
2. **Robot GitHub** (`.github/workflows/documentation.yml`) : à chaque push qui touche le code, Claude relit les changements et met la documentation à jour sur la même branche. Il a besoin du secret `CLAUDE_CODE_OAUTH_TOKEN` dans les réglages du dépôt.
