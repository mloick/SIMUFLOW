-- Test du partage d'un process (membres, invitation, lecture par les membres),
-- sur un PostgreSQL vide (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/partage_rls.sql
--
-- Trois comptes : A (propriétaire), B (invité), C (ni l'un ni l'autre).

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
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261117000000_partage.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr'),
  ('33333333-3333-3333-3333-333333333333', 'c@exemple.fr');

-- Échoue si `sql` passe, au lieu d'être refusé.
create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or check_violation or with_check_option_violation or unique_violation
    or no_data_found or invalid_parameter_value or program_limit_exceeded or undefined_function then null;
end;
$$;

set role authenticated;

-- B a un profil ; C n'en a pas.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.profiles (first_name, last_name, username) values ('Karim', 'Benali', 'karim.benali');

-- A crée un process et invite B par son identifiant, en le reliant à un acteur.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.processes (id, name, content)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Demande de matériel', '{"steps": [], "links": []}');
do $$ begin
  assert (select username from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', '@Karim.Benali ', 'Achats'))
    = 'karim.benali', 'ÉCHEC : A doit pouvoir inviter B par son identifiant';
  assert (select actor from public.members_of('aaaaaaaa-0000-0000-0000-000000000001')) = 'Achats',
    'ÉCHEC : l''acteur de B doit être gardé';
end $$;
-- Réinviter change l'acteur, sans doublon.
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'b@exemple.fr', 'Logistique');
do $$ begin
  assert (select count(*) from public.members_of('aaaaaaaa-0000-0000-0000-000000000001')) = 1, 'ÉCHEC : B en double';
  assert (select actor from public.process_members) = 'Logistique', 'ÉCHEC : l''acteur doit changer';
end $$;
select pg_temp.refuse($$select public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'personne.inconnue')$$,
  'inviter un identifiant qui n''existe pas');
select pg_temp.refuse($$select public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'a@exemple.fr')$$,
  's''inviter soi-même');
select pg_temp.refuse($$insert into public.process_members (process_id, member_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333')$$,
  'ajouter un membre sans passer par l''invitation');

-- B (membre) : lit le process, ne le modifie ni ne le supprime, n'invite personne.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
update public.processes set name = 'Piraté';
delete from public.processes;
do $$ begin
  assert (select count(*) from public.processes) = 1, 'ÉCHEC : B doit voir le process partagé';
  assert (select name from public.processes) = 'Demande de matériel', 'ÉCHEC : B a modifié le process';
  assert (select count(*) from public.members_of('aaaaaaaa-0000-0000-0000-000000000001')) = 1,
    'ÉCHEC : B doit voir les membres du process';
end $$;
select pg_temp.refuse($$select public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'c@exemple.fr')$$,
  'un membre qui invite');
update public.process_members set actor = 'Direction';
do $$ begin
  assert (select actor from public.process_members) = 'Logistique', 'ÉCHEC : B a changé son acteur';
end $$;

-- C (ni propriétaire ni membre) : ne voit rien.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  assert (select count(*) from public.processes) = 0, 'ÉCHEC : C ne doit pas voir le process';
  assert (select count(*) from public.process_members) = 0, 'ÉCHEC : C ne doit pas voir les membres';
  assert (select count(*) from public.members_of('aaaaaaaa-0000-0000-0000-000000000001')) = 0,
    'ÉCHEC : C ne doit pas lire la liste des membres';
end $$;
select pg_temp.refuse($$select public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'c@exemple.fr')$$,
  's''inviter soi-même sur le process d''un autre');

-- Sans connexion (anon) : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.process_members', 'lire les membres sans être connecté');
select pg_temp.refuse($$select public.members_of('aaaaaaaa-0000-0000-0000-000000000001')$$, 'lister sans être connecté');
reset role;

-- B se retire : il ne voit plus le process.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
delete from public.process_members where member_id = auth.uid();
do $$ begin
  assert (select count(*) from public.processes) = 0, 'ÉCHEC : B ne doit plus voir le process après s''être retiré';
end $$;

-- A réinvite C par son adresse (sans profil), puis le retire.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert (select first_name from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'C@Exemple.fr')) is null,
    'ÉCHEC : un compte sans profil s''invite par son adresse, sans nom';
end $$;
delete from public.process_members where member_id = '33333333-3333-3333-3333-333333333333';
do $$ begin
  assert (select count(*) from public.process_members) = 0, 'ÉCHEC : A doit pouvoir retirer un membre';
end $$;

-- Supprimer le process supprime ses membres.
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'karim.benali');
delete from public.processes;
reset role;
do $$ begin
  assert (select count(*) from public.process_members) = 0, 'ÉCHEC : les membres d''un process supprimé doivent partir';
end $$;

\echo 'Partage d''un process : tout est conforme.'
