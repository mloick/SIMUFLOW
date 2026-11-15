-- Test de l'équipe d'un projet (project_members, rôle de chef), sur un
-- PostgreSQL vide (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/equipe_projet_rls.sql
--
-- Quatre comptes : A (chef), B et D (collaborateurs), C (hors projet).

-- Imitation minimale de Supabase (avec l'adresse e-mail des comptes).
do $$ begin
  create role anon nologin;
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to anon, authenticated;

\ir ../migrations/20261030150000_processes.sql
\ir ../migrations/20261116000000_profils.sql
\ir ../migrations/20261117000000_partage.sql
\ir ../migrations/20261118000000_avis.sql
\ir ../migrations/20261120000000_projets.sql
\ir ../migrations/20261121000000_equipe_projet.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261121000000_equipe_projet.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr'),
  ('33333333-3333-3333-3333-333333333333', 'c@exemple.fr'),
  ('44444444-4444-4444-4444-444444444444', 'd@exemple.fr');
insert into public.profiles (id, first_name, last_name, username) values
  ('11111111-1111-1111-1111-111111111111', 'Camille', 'Durand', 'camille'),
  ('22222222-2222-2222-2222-222222222222', 'Julie', 'Martin', 'julie.martin');

-- Échoue si `sql` passe, au lieu d'être refusé.
create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or check_violation or with_check_option_violation or no_data_found
    or invalid_parameter_value then null;
end;
$$;

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false);
$$;

set role authenticated;

-- A crée un projet, y range un process, invite B (identifiant) et D (adresse).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.projects (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Migration du support');
insert into public.processes (name, content, project_id)
  values ('Process de A', '{"steps": [], "links": []}', 'aaaaaaaa-0000-4000-8000-000000000001');
select * from public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', '@julie.martin');
select * from public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', 'D@exemple.fr');
-- Réinviter ne crée pas de doublon.
select * from public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', 'julie.martin');
select pg_temp.refuse($$select public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', 'inconnu')$$,
  'inviter un compte inconnu');
select pg_temp.refuse($$select public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', 'camille')$$,
  's''inviter soi-même');
select pg_temp.refuse($$insert into public.project_members (project_id, member_id)
  values ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333')$$,
  'ajouter quelqu''un sans passer par l''invitation');
do $$ begin
  assert (select count(*) from public.team_of('aaaaaaaa-0000-4000-8000-000000000001')) = 3, 'ÉCHEC : 3 personnes dans l''équipe';
  assert (select role from public.team_of('aaaaaaaa-0000-4000-8000-000000000001') limit 1) = 'chef', 'ÉCHEC : le chef d''abord';
end $$;

-- B : voit le projet, son équipe et le process de A ; y range son propre process ; ne gère rien.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.processes (name, content, project_id)
  values ('Process de B', '{"steps": [], "links": []}', 'aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  assert (select count(*) from public.projects) = 1, 'ÉCHEC : B doit voir le projet';
  assert (select count(*) from public.team_projects()) = 1, 'ÉCHEC : le projet dans « mes projets d''équipe »';
  assert (select chef_username from public.team_projects()) = 'camille', 'ÉCHEC : le nom du chef';
  assert (select count(*) from public.processes) = 2, 'ÉCHEC : B lit les deux process du projet';
  assert (select count(*) from public.shared_with_me()) = 1, 'ÉCHEC : le process de A est partagé avec B';
  assert (select not is_member from public.shared_with_me()), 'ÉCHEC : B n''est pas membre du process de A';
  assert (select count(*) from public.team_of('aaaaaaaa-0000-4000-8000-000000000001')) = 3, 'ÉCHEC : B voit l''équipe';
end $$;
update public.projects set name = 'Piraté';
update public.processes set name = 'Piraté' where name = 'Process de A';
select pg_temp.refuse($$select public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', 'c@exemple.fr')$$,
  'un collaborateur qui invite');
select pg_temp.refuse($$select public.transfer_chef('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222')$$,
  'un collaborateur qui se nomme chef');
delete from public.project_members where member_id = '44444444-4444-4444-4444-444444444444';

-- C : hors projet, ne voit rien.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  assert (select count(*) from public.projects) = 0, 'ÉCHEC : C ne voit pas le projet';
  assert (select count(*) from public.processes) = 0, 'ÉCHEC : C ne lit pas ses process';
  assert (select count(*) from public.team_of('aaaaaaaa-0000-4000-8000-000000000001')) = 0, 'ÉCHEC : C ne voit pas l''équipe';
  assert (select count(*) from public.shared_with_me()) = 0, 'ÉCHEC : rien de partagé avec C';
end $$;
insert into public.processes (name, content) values ('Process de C', '{"steps": [], "links": []}');
select pg_temp.refuse($$update public.processes set project_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'ranger son process dans un projet dont on n''est pas');

-- A : rien n'a été piraté, D est toujours là. A nomme B chef et devient collaborateur.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  assert (select name from public.projects) = 'Migration du support', 'ÉCHEC : B a renommé le projet';
  assert (select count(*) from public.processes where name = 'Piraté') = 0, 'ÉCHEC : B a modifié le process de A';
  assert (select count(*) from public.project_members) = 2, 'ÉCHEC : B a retiré D';
end $$;
select pg_temp.refuse($$select public.transfer_chef('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333')$$,
  'nommer chef quelqu''un hors de l''équipe');
select public.transfer_chef('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222');
do $$ begin
  assert (select role from public.team_of('aaaaaaaa-0000-4000-8000-000000000001') where member_id = auth.uid()) = 'collaborateur',
    'ÉCHEC : l''ancien chef devient collaborateur';
  assert (select count(*) from public.processes where project_id is not null) = 2, 'ÉCHEC : les process restent dans le projet';
end $$;
update public.projects set name = 'Plus le droit';

-- B, nouveau chef : renomme le projet, retire D ; A quitte le projet et ses process en sortent.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  assert (select name from public.projects) = 'Migration du support', 'ÉCHEC : l''ancien chef a renommé le projet';
end $$;
update public.projects set name = 'Migration du support (v2)';
delete from public.project_members where member_id = '44444444-4444-4444-4444-444444444444';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
delete from public.project_members where member_id = auth.uid();
do $$ begin
  assert (select count(*) from public.projects) = 0, 'ÉCHEC : A a quitté le projet';
  assert (select project_id from public.processes where name = 'Process de A') is null, 'ÉCHEC : ses process sortent du projet';
end $$;

-- Sans connexion : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.project_members', 'lire l''équipe sans être connecté');

-- Un chef supprime son compte : le projet passe au plus ancien collaborateur.
reset role;
insert into public.project_members (project_id, member_id)
  values ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333'),
         ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444');
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select chef_id from public.projects) = '33333333-3333-3333-3333-333333333333', 'ÉCHEC : le projet passe à C';
  assert (select count(*) from public.project_members) = 1, 'ÉCHEC : C n''est plus collaborateur, D reste';
end $$;
-- Sans collaborateur, le projet part avec le compte.
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
delete from auth.users where id = '33333333-3333-3333-3333-333333333333';
do $$ begin
  assert (select count(*) from public.projects) = 0, 'ÉCHEC : un projet sans équipe part avec son chef';
end $$;

\echo 'Équipe des projets : tout est conforme.'
