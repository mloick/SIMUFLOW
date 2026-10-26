# Documentation technique

Ce document décrit le code tel qu'il est aujourd'hui, puis l'architecture visée. Il est mis à jour à chaque modification du code (voir « Mise à jour de la documentation » en bas).

## État actuel

Le dépôt contient l'application de départ générée par `create-expo-app` (modèle par défaut), renommée SimuFlow. Aucun écran du simulateur n'est encore codé : l'app affiche les écrans de démonstration d'Expo.

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
  components/   Composants réutilisables
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
| `npx expo start` | Lancer le serveur de développement (QR code pour Expo Go, `i` pour le Simulateur iOS, `a` pour l'émulateur Android) |
| `npx tsc --noEmit` | Vérifier les types |
| `npx expo lint` | Analyser le code (ESLint) |
| `npx expo install <paquet>` | Ajouter une dépendance compatible avec le SDK |

Point connu : `npx tsc --noEmit` signale une erreur dans `src/components/app-tabs.web.tsx`, un fichier du modèle Expo réservé au web. Il disparaîtra avec les écrans de démonstration.

## Architecture visée

Le cœur du simulateur ne dépend pas de l'écran : il sera écrit en TypeScript pur et testé séparément, à partir du prototype web existant.

| Dossier prévu | Rôle |
| --- | --- |
| `src/domain/` | Types du workflow, règles du diagnostic, calcul des chemins |
| `src/import/` | Lecture des fichiers draw.io et JSON, et des tableaux scannés |
| `src/simulation/` | Moteur de simulation : `step(état, choix)` renvoie le nouvel état |
| `src/app/` | Écrans : onglets Process, Scanner, Profil ; détail `[id]` ; simulation ; modale d'import |
| `modules/` | Module natif de lecture de texte (Kotlin pour Android, Swift pour iOS) |

Backend prévu : Supabase (comptes, process partagés, statuts de validation).

## Mise à jour de la documentation

Les fichiers `README.md`, `README.fr.md`, `docs/technique.md` et `docs/fonctionnalites.md` sont tenus à jour de deux façons :

1. **Règle `CLAUDE.md`** : quand Claude modifie le code, il met ces documents à jour dans la même pull request.
2. **Robot GitHub** (`.github/workflows/documentation.yml`) : à chaque push qui touche le code, Claude relit les changements et met la documentation à jour sur la même branche. Il a besoin du secret `CLAUDE_CODE_OAUTH_TOKEN` dans les réglages du dépôt.
