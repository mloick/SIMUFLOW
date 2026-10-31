# Sécurité

Ce document rassemble les mesures de sécurité de SimuFlow : d'abord la checklist remplie, point par point, puis le détail de chaque mesure.

## Checklist sécurité

La checklist suit les catégories de l'OWASP MASVS (référentiel de sécurité des apps mobiles), complétées par le backend et le dépôt. État au 31 octobre 2026.

✅ fait et vérifié · ⚠️ à améliorer (voir plus bas) · ➖ sans objet pour SimuFlow

### Données sur le téléphone (MASVS-STORAGE)

| Point | État | Preuve |
| --- | --- | --- |
| Aucun secret dans l'app : seulement l'adresse Supabase et la clé publishable | ✅ | `src/backend/config.ts` ; la clé `service_role` n'existe ni dans l'app ni dans le dépôt |
| Données de l'app dans son espace privé, inaccessible aux autres apps | ✅ | Process dans le dossier Documents de l'app (`saved-file.ts`), réglages et demandes suivies dans sa base SQLite |
| Jeton de session gardé de façon chiffrée (Keychain iOS, Keystore Android) | ✅ | `expo-secure-store` (`secure-session-storage.ts`), réservé à ce téléphone (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) ; l'ancienne copie non chiffrée est déplacée puis effacée (`session-storage.ts`, testé) |
| Données du compte retirées du téléphone à la déconnexion et à la suppression du compte | ✅ | `cloud-sync.ts` vide les copies du compte ; testé avec deux comptes sur le même téléphone |
| Sauvegarde Android (`allowBackup`) exclue pour les données sensibles | ✅ | `android.allowBackup: false` dans `app.json` : aucune donnée de l'app n'est copiée dans la sauvegarde Google |
| Pas de données personnelles dans les journaux | ✅ | Les `console.warn` ne montrent que des codes d'erreur, et la plupart seulement en développement (`__DEV__`) |
| Photos du Scanner jamais envoyées | ✅ | Lecture sur le téléphone (Vision, ML Kit), image dans le dossier temporaire |

### Chiffrement (MASVS-CRYPTO)

| Point | État | Preuve |
| --- | --- | --- |
| Aucun algorithme de chiffrement écrit à la main | ✅ | Le chiffrement est fait par HTTPS (système) et par Supabase (mots de passe hachés) |
| Aucune clé de chiffrement dans le code | ✅ | Clés de signature gardées par EAS, jamais dans le dépôt |

### Comptes et connexion (MASVS-AUTH)

| Point | État | Preuve |
| --- | --- | --- |
| Authentification par un service éprouvé, pas maison | ✅ | Supabase Auth (e-mail et mot de passe), mots de passe hachés côté serveur |
| Toutes les règles d'accès appliquées par le serveur, pas par l'app | ✅ | Row Level Security sur `processes` et `reading_rules` : `(select auth.uid()) = owner_id` |
| Règles d'accès testées avec deux comptes | ✅ | `supabase/tests/processes_rls.sql`, `regles_lecture_rls.sql`, `suppression_compte.sql`, dont un test cassé exprès |
| Aucun droit sans connexion | ✅ | Rôle `anon` sans aucun droit sur les tables |
| Jeton de courte durée, renouvelé seulement app ouverte | ✅ | Expiration une heure ; `startAutoRefresh` / `stopAutoRefresh` selon `AppState` (`client.ts`) |
| Suppression du compte depuis l'app | ✅ | `delete_my_account()` (`security definer`, `search_path` vide), données supprimées en cascade |
| Mot de passe oublié sans révéler si une adresse a un compte | ✅ | Même réponse dans les deux cas ; lien à usage unique valable une heure |
| Mot de passe robuste | ✅ | 8 caractères au moins, avec minuscule, majuscule, chiffre et symbole, vérifiés par l'app (`passwordProblem`, testé) et par Supabase (réglages « Minimum password length » et « Password requirements » du projet) |
| Limitation des tentatives (force brute) | ✅ | Limites de Supabase Auth sur la connexion et l'envoi d'e-mails |

### Réseau (MASVS-NETWORK)

| Point | État | Preuve |
| --- | --- | --- |
| Toutes les connexions en HTTPS | ✅ | Supabase et EAS Update en `https://` ; App Transport Security (iOS) et blocage du HTTP en clair (Android) laissés actifs par défaut |
| Aucun autre serveur contacté | ✅ | Ni publicité, ni mesure d'audience, ni service de notifications push (`enableRemoteNotifications: false`) |

### Plateforme (MASVS-PLATFORM)

| Point | État | Preuve |
| --- | --- | --- |
| Autorisations au minimum, demandées au bon moment avec une explication | ✅ | Appareil photo à l'ouverture du Scanner (micro et codes-barres non demandés) ; notifications au premier rappel |
| Liens entrants (`simuflow://`) traités comme des données non fiables | ✅ | Seul `nouveau-mot-de-passe` lit l'adresse ; `parseRecoveryLink` n'accepte qu'un jeton de récupération ou une erreur connue (testé) |
| Lien de récupération réservé à SimuFlow | ⚠️ | Un schéma `simuflow://` peut être déclaré par une autre app sur Android ; des liens universels (domaine vérifié) le réserveraient. Risque limité : lien à usage unique, valable une heure |
| Pages web ouvertes dans le navigateur du système, sans accès à l'app | ✅ | `WebBrowser.openBrowserAsync` (politique de confidentialité) ; aucune WebView qui exécute du code |

### Code et dépendances (MASVS-CODE)

| Point | État | Preuve |
| --- | --- | --- |
| Fichiers importés lus comme des données, refusés proprement s'ils sont abîmés | ✅ | Lecteurs draw.io et JSON testés avec des fichiers invalides ; jamais d'`eval` |
| Contenu vérifié aussi par la base | ✅ | Contraintes : nom de 1 à 200 caractères, origine parmi `drawio`, `scan`, `json`, listes d'étapes et de liens, au plus 500 règles |
| Dépendances à jour, installées depuis le fichier verrou | ✅ | `npx expo install --check` avant chaque build iOS ; `npm ci` en CI |
| Failles connues dans les dépendances | ✅ | `npm audit --omit=dev` (31 oct.) : 0 critique, 0 haute ; 14 modérées, toutes dans les outils de build d'Expo (`glob`, `minimatch`), qui ne sont pas embarqués dans l'app |
| Vérifications automatiques à chaque pull request | ✅ | `.github/workflows/verifications.yml` : types, lint, 210 tests |

### Résistance (MASVS-RESILIENCE)

| Point | État | Preuve |
| --- | --- | --- |
| Protection contre la rétro-ingénierie, détection du jailbreak | ➖ | Pas de secret ni de logique sensible dans l'app : tout ce qui protège les données est sur le serveur (RLS) |
| Mises à jour à distance signées par le compte du projet | ✅ | EAS Update : publication réservée au compte Expo du projet, limitée aux builds de même version |

### Vie privée (MASVS-PRIVACY)

| Point | État | Preuve |
| --- | --- | --- |
| Politique de confidentialité publiée et accessible depuis l'app | ✅ | [Site](https://mloick.github.io/SIMUFLOW/confidentialite.html), lien dans Profil et à la création du compte |
| Données réduites au nécessaire | ✅ | Compte : e-mail et mot de passe ; aucune donnée sur le serveur sans compte |
| Hébergement en Union européenne | ✅ | Supabase, région Paris |
| Exemples uniquement fictifs | ✅ | Règle de `CLAUDE.md`, appliquée au code et à la documentation |

### Dépôt et secrets

| Point | État | Preuve |
| --- | --- | --- |
| Aucun secret dans le dépôt public | ✅ | `.gitignore` exclut `.env`, clés, certificats, `.claude/` ; seul le secret `CLAUDE_CODE_OAUTH_TOKEN` existe, dans les réglages GitHub |
| Droits des workflows GitHub limités | ✅ | `permissions` déclarées dans chaque workflow : vérifications en lecture seule, site avec `pages: write` et `id-token: write`, robot de documentation avec `contents: write` (pour committer la documentation) |
| Mots de passe et clés du projet Supabase hors de l'app et du dépôt | ✅ | Mot de passe de la base et clé `service_role` restent dans le compte Supabase |

### Points à améliorer

- **Liens universels** pour la récupération du mot de passe, avec un domaine vérifié (Apple App Site Association, Android App Links) : à envisager si l'app est publiée sur les stores.

Corrigés le 31 octobre (étape 14c) : le jeton de session est passé dans le trousseau chiffré, la sauvegarde Android est désactivée, et le mot de passe demande 8 caractères avec minuscule, majuscule, chiffre et symbole.


## Secrets et clés

- Seules l'adresse du projet Supabase et sa clé **publishable** sont dans l'app (`src/backend/config.ts`). Elles sont publiques par conception et n'ouvrent que ce que les règles d'accès autorisent.
- La clé secrète (`service_role`) et le mot de passe de la base ne sont ni dans l'app ni dans le dépôt, et ne sont jamais transmis en dehors du compte Supabase.
- Les mises à jour à distance (EAS Update) ne peuvent être publiées que depuis le compte Expo du projet, et ne sont proposées qu'aux builds de la même version.
- Les clés de signature de l'app (Android, et iOS plus tard) sont créées et gardées par EAS (Expo), jamais dans le dépôt.
- `.gitignore` exclut `.env`, les clés et certificats, et les fichiers locaux de Claude Code (`.claude/`, `CLAUDE.local.md`).

## Données et règles d'accès (Supabase)

- Projet hébergé en Union européenne (région Paris).
- Nouvelles tables non exposées automatiquement : chaque accès est donné explicitement (`grant`).
- Row Level Security activée sur `processes` : chaque compte ne lit, ne crée, ne modifie et ne supprime que ses propres process (`(select auth.uid()) = owner_id`). Le rôle `anon` (sans connexion) n'a aucun droit.
- La base vérifie le contenu : nom de 1 à 200 caractères, origine parmi `drawio`, `scan`, `json`, étapes et liens sous forme de listes.
- Règles testées avec deux comptes sur un PostgreSQL local (`supabase/tests/processes_rls.sql`), y compris un test cassé exprès pour vérifier qu'il détecte une faille.
- Règles de lecture apprises : table `reading_rules`, une ligne par compte, mêmes protections (RLS par propriétaire, rien sans connexion, au plus 500 règles en liste, supprimées avec le compte). Testée de la même façon (`supabase/tests/regles_lecture_rls.sql`).

## Comptes

- Connexion par e-mail et mot de passe (Supabase Auth). Les mots de passe sont stockés chiffrés par Supabase ; l'app ne les garde pas.
- Mot de passe oublié : lien à usage unique envoyé par e-mail, valable une heure, qui ne rouvre que l'app (adresse `simuflow://` autorisée dans Supabase), puis nouveau mot de passe qui suit la même règle qu'à la création. L'app répond pareil que l'adresse ait un compte ou non, pour ne pas révéler qui est inscrit ; Supabase limite le nombre d'e-mails envoyés.
- Mot de passe d'au moins 8 caractères à la création, avec une minuscule, une majuscule, un chiffre et un symbole (vérifié par l'app et par Supabase ; un compte plus ancien peut toujours se connecter avec son mot de passe). Les messages d'erreur ne révèlent pas si une adresse a déjà un compte quand la confirmation par e-mail est active.
- La session (jeton) est gardée dans le trousseau chiffré du téléphone (Keychain, Keystore), jamais copiée vers un autre appareil, et renouvelée seulement tant que l'app est ouverte. Les données de l'app sont exclues de la sauvegarde Android.
- Suppression du compte depuis l'app : fonction `delete_my_account()` (`security definer`, `search_path` vide), limitée au compte connecté et refusée sans connexion ; ses process sont supprimés avec lui (`on delete cascade`). Testée avec deux comptes (`supabase/tests/suppression_compte.sql`).

## Sur le téléphone

- Les process importés sont enregistrés dans le dossier Documents de l'app, inaccessible aux autres apps.
- À la déconnexion ou à la suppression du compte, les copies des process et des règles de lecture du compte sont retirées du téléphone : un autre compte connecté sur le même téléphone ne les voit pas.
- Appareil photo : demandé seulement à l'ouverture du Scanner, avec un message qui dit à quoi il sert. Pas de micro ni de lecture de codes-barres (autorisations non demandées). Les photos restent dans le cache de l'app et ne sont envoyées nulle part. La lecture du texte se fait sur le téléphone (module natif : Vision sur iOS, ML Kit avec son modèle inclus dans l'app sur Android) : aucun service en ligne, aucun envoi de la photo ni du texte lu. L'image recadrée sur le document reste dans le dossier temporaire de l'app.
- Notifications : uniquement locales, programmées par le téléphone ; aucun jeton push, aucun serveur de notifications (`enableRemoteNotifications: false`). L'autorisation n'est demandée qu'en activant les rappels, et peut être coupée dans le Profil.
- Les fichiers importés (draw.io, JSON) sont lus comme des données : un fichier abîmé ou inattendu est refusé avec un message, sans planter l'app.

## Confidentialité

- Uniquement des exemples fictifs dans l'app, le code et la documentation.
- Politique de confidentialité publiée sur le site du projet (`docs/site/confidentialite.html`, https://mloick.github.io/SIMUFLOW/confidentialite.html) et ouverte depuis le Profil et l'écran de création de compte. Elle liste chaque donnée, où elle est gardée, les services tiers (Supabase, Expo EAS Update) et la suppression du compte. Pas de publicité ni de mesure d'audience dans l'app.
