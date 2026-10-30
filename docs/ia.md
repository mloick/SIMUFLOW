# Développer SimuFlow avec l'IA

SimuFlow est développé avec Claude Code (Anthropic). Ce document dit ce qui guide l'IA et comment nous travaillons ensemble. Il est complété à chaque étape.

## Ce qui guide l'IA

- **`AGENTS.md`** : règles pour une app Expo. Lire la documentation Expo de la version installée (SDK 58) plutôt que se fier à sa mémoire, installer les paquets avec `npx expo install`, utiliser Expo Router, ne jamais modifier `ios/` et `android/` à la main, lancer le lint et le contrôle des types avant de dire qu'une tâche est finie.
- **`CLAUDE.md`** : règles du projet. Interface et documentation en français, README en anglais et en français, mise à jour de `docs/technique.md` et `docs/fonctionnalites.md` à chaque changement de code, captures d'écran pour chaque étape qui change un écran, uniquement des exemples fictifs.
- **Robot de documentation** (`.github/workflows/documentation.yml`) : après chaque push qui touche le code, Claude relit les changements et met la documentation à jour.
- **Outils (MCP)** : GitHub (branches, pull requests, vérifications), Claude Docs (récaps et documents de travail).
- **Checklist du projet final** : depuis l'étape 8, la feuille de route suit la checklist du cours ; chaque étape dit quels points elle coche.

## Comment nous travaillons

- **Une étape à la fois.** Je demande une étape ; Claude la fait seule, sur une branche, dans une pull request. Rien n'avance sans ma validation.
- **Je fusionne.** Claude ne fusionne une pull request que quand je le dis, après avoir testé sur mon iPhone.
- **Je teste en vrai.** Claude teste dans son environnement (tests automatiques, version web, serveur simulé) ; je teste sur le téléphone avec le vrai serveur. Les bugs trouvés ainsi (compilation Xcode, suppression de compte refusée) sont corrigés dans la même pull request.
- **Je garde la main sur les secrets.** Les réglages Supabase et le SQL sont appliqués par moi dans le tableau de bord ; la clé secrète ne sort jamais de mon compte.
- **Un récap après chaque étape** (« comment j'ai procédé »), plus détaillé pour le backend, pour pouvoir l'expliquer à l'oral.

## Ce que je vérifie moi-même

- Le comportement sur le téléphone (iPhone, mode sombre, VoiceOver).
- Les données dans Supabase (comptes, table `processes`).
- Les captures et la documentation avant chaque fusion.
- L'icône et l'écran de démarrage sur l'écran d'accueil : Claude les produit à partir du tracé du logo que j'ai choisi, sans IA générative d'images.
