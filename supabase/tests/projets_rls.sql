-- Test des projets (table projects, processes.project_id), sur un PostgreSQL
-- vide (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/projets_rls.sql
--
-- Deux comptes : A (chef de son projet) et B (un autre compte).

-- Imitation minimale de Supabase.
do $$ begin
  create role anon nologin;
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to anon, authenticated;

\ir ../migrations/20261030150000_processes.sql
\ir ../migrations/20261120000000_projets.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261120000000_projets.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Échoue si `sql` passe, au lieu d'être refusé.
create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or check_violation or with_check_option_violation then null;
end;
$$;

-- Compte A : crée un projet (identifiant choisi par le téléphone) et y range un process.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.projects (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Migration du support');
insert into public.processes (name, content, project_id)
  values ('Ouvrir un ticket', '{"steps": [], "links": []}', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.processes (name, content) values ('Hors projet', '{"steps": [], "links": []}');

do $$ begin
  assert (select chef_id from public.projects) = auth.uid(), 'ÉCHEC : le créateur doit être chef du projet';
  assert (select count(*) from public.processes where project_id is not null) = 1, 'ÉCHEC : un process rangé';
end $$;

select pg_temp.refuse($$insert into public.projects (name) values ('  ')$$, 'un projet sans nom');
select pg_temp.refuse(
  $$insert into public.projects (name, chef_id) values ('Usurpation', '22222222-2222-2222-2222-222222222222')$$,
  'créer un projet au nom d''un autre compte');

-- Compte B : ne voit pas le projet de A et ne peut pas y ranger son process.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.processes (name, content) values ('Process de B', '{"steps": [], "links": []}');
do $$ begin
  assert (select count(*) from public.projects) = 0, 'ÉCHEC : B ne doit pas voir le projet de A';
end $$;
select pg_temp.refuse(
  $$update public.processes set project_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'ranger son process dans le projet d''un autre');
update public.projects set name = 'Piraté';
delete from public.projects;

-- Sans connexion : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.projects', 'lire les projets sans être connecté');

-- A supprime son projet : ses process restent, hors projet.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert (select name from public.projects) = 'Migration du support', 'ÉCHEC : B a modifié le projet de A';
end $$;
-- Modifier un process rangé sans changer son projet reste possible.
update public.processes set name = 'Ouvrir un ticket (v2)' where project_id is not null;
delete from public.projects;
do $$ begin
  assert (select count(*) from public.processes) = 2, 'ÉCHEC : supprimer un projet ne doit pas supprimer ses process';
  assert (select count(*) from public.processes where project_id is not null) = 0, 'ÉCHEC : les process sortent du projet';
end $$;

-- Supprimer le compte A supprime ses projets.
reset role;
insert into public.projects (id, chef_id, name)
  values ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Autre');
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.projects) = 0, 'ÉCHEC : les projets d''un compte supprimé doivent partir';
end $$;

\echo 'Règles de sécurité des projets : tout est conforme.'
