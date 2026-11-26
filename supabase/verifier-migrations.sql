-- SimuFlow : quels scripts de supabase/migrations/ sont passés sur la base ?
--
-- À coller dans Supabase : SQL Editor > New query > Run. Ne change rien,
-- ne fait que lire. Une ligne par script, avec « oui » s'il a été appliqué
-- (on cherche ce qu'il crée : une table, une fonction, une colonne).
--
-- Sert une fois, avant de passer à la CLI Supabase : si tout est « oui »,
-- on marque ces scripts comme déjà appliqués (`supabase migration repair`),
-- sans les relancer. Voir docs/technique.md, « Appliquer les scripts SQL ».

with source_check as (
  select coalesce(
    (select pg_get_constraintdef(oid) from pg_constraint where conname = 'processes_source_check'), ''
  ) as def
)
select version, script, case when ok then 'oui' else 'NON' end as applique
from source_check, (values
  ('20261030150000', 'processes',          to_regclass('public.processes') is not null),
  ('20261030170000', 'suppression_compte', to_regprocedure('public.delete_my_account()') is not null),
  ('20261031120000', 'regles_lecture',     to_regclass('public.reading_rules') is not null),
  ('20261110150000', 'source_tableau',     (select def like '%tableau%' from source_check)),
  ('20261112230000', 'formulaires',        to_regclass('public.saved_forms') is not null),
  ('20261113000000', 'source_bpmn',        (select def like '%bpmn%' from source_check)),
  ('20261114000000', 'source_visio',       (select def like '%visio%' from source_check)),
  ('20261115000000', 'source_texte',       (select def like '%texte%' from source_check)),
  ('20261116000000', 'profils',            to_regclass('public.profiles') is not null),
  ('20261117000000', 'partage',            to_regclass('public.process_members') is not null),
  ('20261118000000', 'avis',               to_regclass('public.step_reviews') is not null),
  ('20261119000000', 'liens_acteurs',      to_regclass('public.actor_links') is not null),
  ('20261120000000', 'projets',            to_regclass('public.projects') is not null),
  ('20261121000000', 'equipe_projet',      to_regclass('public.project_members') is not null),
  ('20261122000000', 'tableau_de_bord',    to_regprocedure('public.in_my_project(uuid)') is not null),
  ('20261123000000', 'liens_equipe',       to_regprocedure('public.link_activity_of(uuid)') is not null),
  ('20261124000000', 'avis_sa_partie',     to_regprocedure('public.is_my_step(uuid,text)') is not null),
  ('20261125000000', 'liens_expiration',   to_regprocedure('public.link_extend(uuid)') is not null),
  ('20261126000000', 'liens_consultation', to_regclass('public.view_links') is not null)
) as scripts(version, script, ok)
order by version;
