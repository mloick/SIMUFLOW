# Carte du code

Une page pour se repérer vite, avant de lire le code. Le détail est dans [technique.md](technique.md).

## Où est quoi

| Je cherche… | Dossier ou fichier |
| --- | --- |
| Un écran | `src/app/` (un fichier = une route Expo Router ; onglets dans `(tabs)/`) |
| Un morceau d'écran réutilisé | `src/components/` |
| Un texte affiché (français / anglais) | `src/i18n/messages/` : `fr.ts` et `en.ts` (base, Profil, connexion), `fr-ecrans.ts` et `en-ecrans.ts` (tous les autres écrans, un bloc par écran) |
| Les règles d'un process (types, diagnostic, chemins, avis, alertes) | `src/domain/` (TypeScript pur, sans React) |
| Le moteur de simulation, le schéma, les familles de chemins | `src/simulation/` |
| La lecture d'un fichier (draw.io, BPMN, Visio, JSON, texte) | `src/import/` ; tableaux Excel et CSV dans `src/import/tableau/` |
| L'export (PDF, draw.io, BPMN, JSON) | `src/export/` |
| Le Scanner (photo → tableau → process) | `src/scan/` et `modules/text-recognition/` (Swift, Kotlin, web) |
| Les données gardées sur le téléphone, la synchronisation | `src/data/` (`process-store.ts`, `cloud-sync.ts`, `*-store.ts`) ; projets dans `project-store.ts` et `project-sync.ts`, projets d'équipe dans `team-projects-store.ts`, vue commune avec le rôle dans `project-view.ts` |
| Le serveur Supabase (compte, process, projets, profil, partage, liens) | `src/backend/` ; tables et règles dans `supabase/migrations/`, leurs tests dans `supabase/tests/` |
| Le suivi en vrai, les jours ouvrés, les rappels, le mode Délais (chronos SLA / OLA, bilan) | `src/tracking/` (`delays.ts`) et `src/notifications/` ; règles du SLA dans `src/domain/delays.ts` |
| Les raccourcis Siri (App Intents, iOS) | `plugins/raccourcis-siri/Raccourcis.swift`, ajouté au projet iOS par `plugins/with-raccourcis-siri.js` |
| Couleurs (4 palettes), police, espacements | `src/constants/theme.ts` ; palette choisie dans `src/data/palette-setting.ts` |
| Petites fonctions (pluriel, fichiers, partage, confirmation) | `src/utils/` (`.web.ts` = version navigateur) |

## Règles à suivre

- **Textes** : jamais de texte en dur dans un écran. `const t = useT()` dans un composant, et on passe `t` aux fonctions d'aide. `getT()` seulement hors d'un écran (messages d'erreur, notifications). Ajouter la clé dans `fr-ecrans.ts` puis dans `en-ecrans.ts` : TypeScript signale celle qui manque.
- **React Compiler** est activé : un `getT()` pendant l'affichage garde l'ancienne langue, et un `useMemo` qui produit du texte a `t` dans ses dépendances.
- **Confirmation** : `confirmAction(titre, message, bouton, action, t.common.cancel)`.
- **Natif** : pas de `ios/` ni `android/` à la main ; tout passe par `app.json`. Une dépendance s'ajoute avec `npx expo install`.
- **Documentation** : toute modification du code met à jour, dans la même PR, `README.md`, `README.fr.md`, `docs/technique.md` et `docs/fonctionnalites.md`, plus une capture `docs/captures/etape-<n>-<sujet>.png` si un écran change (voir `CLAUDE.md`).
- **Exemples fictifs** uniquement.

## Avant une pull request

```bash
npx tsc --noEmit   # types
npx expo lint      # lint
npx jest           # tests (l'app y est lue en français)
```

## Pièges connus

- Après chaque push, une GitHub Action peut ajouter un commit « Mettre à jour la documentation » sur la branche : récupérer la branche avant de pousser à nouveau.
- Dans le conteneur cloud, `npx expo start --web` ne recharge pas les fichiers modifiés : relancer le serveur avant une capture.
- Un script SQL dans `supabase/migrations/` est à coller par Loïc dans l'éditeur SQL de Supabase : le dire dans la PR.
- La version web (`site.yml`) se publie à chaque fusion sur `main`, en environ 2 minutes.
