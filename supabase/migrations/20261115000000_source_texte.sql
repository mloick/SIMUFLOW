-- SimuFlow : accepter la source « texte » (process écrit en texte, une ligne
-- par étape, collé dans l'app ou lu dans un fichier .txt) dans la table des
-- process.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Le script peut être
-- relancé sans risque, et il contient aussi les sources « bpmn » et « visio ».
--
-- Sans ce script, l'envoi sur le serveur d'un process lu dans un texte serait
-- refusé (il resterait sur le téléphone).

alter table public.processes drop constraint if exists processes_source_check;

alter table public.processes
  add constraint processes_source_check
  check (source in ('drawio', 'scan', 'json', 'tableau', 'bpmn', 'visio', 'texte'));
