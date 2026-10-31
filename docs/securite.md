# Sécurité

Ce document rassemble les mesures de sécurité de SimuFlow. Il est complété à chaque étape ; il sera remis en forme selon la checklist sécurité du cours.

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
- Mot de passe d'au moins 6 caractères à la création. Les messages d'erreur ne révèlent pas si une adresse a déjà un compte quand la confirmation par e-mail est active.
- La session (jeton) est gardée sur le téléphone et renouvelée seulement tant que l'app est ouverte.
- Suppression du compte depuis l'app : fonction `delete_my_account()` (`security definer`, `search_path` vide), limitée au compte connecté et refusée sans connexion ; ses process sont supprimés avec lui (`on delete cascade`). Testée avec deux comptes (`supabase/tests/suppression_compte.sql`).

## Sur le téléphone

- Les process importés sont enregistrés dans le dossier Documents de l'app, inaccessible aux autres apps.
- À la déconnexion ou à la suppression du compte, les copies des process et des règles de lecture du compte sont retirées du téléphone : un autre compte connecté sur le même téléphone ne les voit pas.
- Appareil photo : demandé seulement à l'ouverture du Scanner, avec un message qui dit à quoi il sert. Pas de micro ni de lecture de codes-barres (autorisations non demandées). Les photos restent dans le cache de l'app et ne sont envoyées nulle part. La lecture du texte se fait sur le téléphone (module natif : Vision sur iOS, ML Kit avec son modèle inclus dans l'app sur Android) : aucun service en ligne, aucun envoi de la photo ni du texte lu. L'image recadrée sur le document reste dans le dossier temporaire de l'app.
- Notifications : uniquement locales, programmées par le téléphone ; aucun jeton push, aucun serveur de notifications (`enableRemoteNotifications: false`). L'autorisation n'est demandée qu'en activant les rappels, et peut être coupée dans le Profil.
- Les fichiers importés (draw.io, JSON) sont lus comme des données : un fichier abîmé ou inattendu est refusé avec un message, sans planter l'app.

## Confidentialité

- Uniquement des exemples fictifs dans l'app, le code et la documentation.
- Politique de confidentialité : à écrire (étape « Rendu »).
