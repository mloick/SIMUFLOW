-- SimuFlow : accepter la source « bpmn » (process importé depuis un schéma
-- BPMN 2.0, fichier .bpmn) dans la table des process.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Le script peut être
-- relancé sans risque.
--
-- Sans ce script, l'envoi sur le serveur d'un process importé depuis un
-- fichier .bpmn serait refusé (il resterait sur le téléphone).

alter table public.processes drop constraint if exists processes_source_check;

alter table public.processes
  add constraint processes_source_check check (source in ('drawio', 'scan', 'json', 'tableau', 'bpmn'));
