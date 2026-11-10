-- SimuFlow, étape 19b : accepter la source « tableau » (process importé depuis
-- un tableau Excel ou CSV) dans la table des process.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Le script peut être
-- relancé sans risque.
--
-- La colonne `source` n'acceptait que drawio, scan et json : sans ce script,
-- l'envoi sur le serveur d'un process importé depuis un tableau serait refusé
-- (il resterait sur le téléphone).

alter table public.processes drop constraint if exists processes_source_check;

alter table public.processes
  add constraint processes_source_check check (source in ('drawio', 'scan', 'json', 'tableau'));
