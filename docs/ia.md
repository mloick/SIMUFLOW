# Développer SimuFlow avec l'IA

SimuFlow est développé avec Claude Code (Anthropic). Ce document dit ce qui a guidé l'IA, comment nous avons travaillé ensemble, et ce que je vérifie moi-même. État au 31 octobre 2026 : près de 60 pull requests, 216 tests automatiques.

## Les outils

- **Claude Code sur le web**, dans un projet claude.ai : une conversation principale tient la feuille de route et prépare l'oral ; chaque étape a sa propre conversation, qui travaille sur une copie du dépôt dans le cloud, ouvre la pull request et me fait un récap.
- **Claude Code sur mon Mac**, dans VS Code (extensions Claude Code, Expo Tools, ESLint, Prettier) : pour ce qui demande le Mac, comme compiler l'app avec Xcode ou lancer Maestro.
- **Ce que l'IA ne fait pas** : compiler pour l'iPhone, tester sur le téléphone, toucher au tableau de bord Supabase. C'est moi qui le fais.

## Ce qui guide l'IA

### Fichiers d'instructions du dépôt

- **`AGENTS.md`** (modèle fourni par Expo) : lire la documentation Expo de la version installée (SDK 58) plutôt que se fier à sa mémoire ; installer les paquets avec `npx expo install` ; utiliser Expo Router ; ne jamais modifier `ios/` et `android/` à la main ; lancer le lint et le contrôle des types avant de dire qu'une tâche est finie.
- **`CLAUDE.md`** (écrit pour le projet) : interface et documentation en français, README en anglais et en français ; à chaque changement de code, mettre à jour `README.md`, `README.fr.md`, `docs/technique.md` et `docs/fonctionnalites.md` dans la même pull request ; captures d'écran pour chaque étape qui change un écran ; uniquement des exemples fictifs, aucun nom réel d'entreprise, de client ou de service.

### Mémoire du projet

Claude garde des notes d'une conversation à l'autre : la feuille de route et l'état de chaque étape, mes préférences de travail, les réglages du projet Supabase (sans aucun secret), les pièges déjà rencontrés (par exemple : après un changement d'`app.json`, il faut `npx expo prebuild --clean`). Une nouvelle conversation repart ainsi de là où la précédente s'était arrêtée.

### Skills

Pas de skill personnalisée dans le dépôt : les règles du projet tiennent dans `AGENTS.md` et `CLAUDE.md`. Claude utilise ses skills intégrées pour les documents à part (récap du backend, audit de la checklist, maquette des écrans, pitch de l'oral).

### Outils connectés (MCP)

- **GitHub** : branches, pull requests, résultat des vérifications, fusion quand je le demande.
- **Claude Docs et Artifacts** : documents de travail hors du dépôt (maquette des 10 écrans, cadrage mobile, audit de la checklist du cours, explication du backend pour l'oral, pitch).
- Pas d'outil connecté à Supabase : l'IA n'a jamais accès à la base ni à la clé secrète.

### Garde-fous automatiques

- **Vérifications** (`.github/workflows/verifications.yml`) : types, lint et tests à chaque pull request. Une case rouge, on ne fusionne pas.
- **Robot de documentation** (`.github/workflows/documentation.yml`) : après chaque push qui touche le code, Claude relit les changements et complète la documentation sur la même branche.

### La checklist du cours

Depuis l'étape 8, la feuille de route suit la checklist du projet final : chaque étape dit quels points elle coche. La checklist sécurité (`docs/securite.md`) a servi de grille de relecture et a fait trouver trois corrections (étape 14c).

## Les prompts

Je donne la direction en une phrase, souvent dictée ; les règles détaillées sont dans les fichiers ci-dessus, pas dans chaque demande. Quelques exemples réels :

- Lancer une idée : « Je voudrais une lecture intelligente des schémas importés, quel que soit le style du dessin. » Claude propose un plan découpé en étapes ; je choisis où l'insérer dans la feuille de route.
- Fixer une exigence : « Les acteurs sont des services, pas des noms de personnes. » ; « Elle doit lire n'importe quel schéma : sans losanges, sans couleurs. »
- Valider ou relancer : « C'est bon, ça marche, fusionne et on continue. » ; « Continue. »
- Signaler un problème : je colle l'erreur ou une capture d'écran (« The action 'GO_BACK' was not handled… Dois-je m'en inquiéter ? ») et Claude explique, corrige et me redonne la commande de test.
- Demander de l'aide pas à pas : « Dans Supabase, en anglais, qu'est-ce que je dois appuyer exactement ? »

## Comment nous travaillons

- **Une petite étape à la fois.** Claude fait une seule étape, sur une branche, dans une pull request, et attend. Rien n'avance sans ma validation.
- **Je teste, puis je fusionne.** Claude teste dans son environnement (types, lint, tests, version web avec des captures) ; je teste sur mon iPhone avec le vrai serveur. Claude ne fusionne que quand je dis « fusionne ».
- **Un récap après chaque étape** (« comment j'ai procédé »), plus détaillé pour le backend, avec les points de la checklist cochés, pour pouvoir l'expliquer à l'oral.
- **Je garde la main sur les secrets.** Le SQL est versionné dans `supabase/migrations/` ; c'est moi qui l'exécute dans le tableau de bord. La clé `service_role` et le mot de passe de la base ne quittent jamais mon compte.
- **Des commandes à copier-coller.** Chaque test sur le Mac arrive avec la commande exacte (`git fetch`, `git checkout -f <branche>`, recompilation si besoin).

## Ce que l'IA a mal fait, et comment on l'a vu

- **Navigation au premier lancement** : la présentation essayait de revenir à un écran qui n'existait pas (« GO_BACK »). Vu en testant sur l'iPhone, corrigé dans la même pull request.
- **Modèle d'e-mail Supabase** : le premier plan du mot de passe oublié reposait sur un code à 6 chiffres, mais l'offre gratuite de Supabase ne permet pas de modifier l'e-mail. Vu sur ma capture du tableau de bord ; Claude est passé à un lien qui rouvre l'app.
- **Règle du mot de passe** : l'app demandait 8 caractères, mais j'avais choisi dans Supabase d'exiger aussi minuscule, majuscule, chiffre et symbole. Vu sur ma capture ; l'app a été alignée.
- **Documentation Expo injoignable** depuis l'environnement de Claude : il lit alors les types des paquets installés (`node_modules`), qui correspondent exactement à la version du projet.
- **Captures prises sur la version web** : elles montrent la mise en page, pas le rendu exact de l'iPhone (icônes système absentes). Le test sur le téléphone reste nécessaire.

## Ce que je vérifie moi-même

- Le comportement sur le téléphone : iPhone, mode sombre, VoiceOver, grands textes, appareil photo, notifications.
- Les données dans Supabase (comptes, tables `processes` et `reading_rules`), avec deux comptes.
- Les captures et la documentation avant chaque fusion.
- L'icône et l'écran de démarrage : Claude les produit à partir du tracé du logo que j'ai choisi, sans IA générative d'images.
