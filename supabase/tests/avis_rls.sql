-- Test des avis par étape sur un process partagé, sur un PostgreSQL vide
-- (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/avis_rls.sql
--
-- Quatre comptes : A (propriétaire), B et D (membres), C (ni l'un ni l'autre).

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
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261118000000_avis.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr'),
  ('33333333-3333-3333-3333-333333333333', 'c@exemple.fr'),
  ('44444444-4444-4444-4444-444444444444', 'd@exemple.fr');

-- Échoue si `sql` passe, au lieu d'être refusé.
create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or check_violation or with_check_option_violation or foreign_key_violation
    or undefined_function then null;
end;
$$;

set role authenticated;

-- A a un profil, crée un process et invite B (Achats) et D (sans acteur).
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.profiles (first_name, last_name, username) values ('Julie', 'Martin', 'julie.martin');
insert into public.processes (id, name, content)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Demande de matériel', '{"steps": [], "links": []}');
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'b@exemple.fr', 'Achats');
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'd@exemple.fr');

-- B voit le process partagé avec lui, son acteur et le nom de A.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.shared_with_me()) = 1, 'ÉCHEC : B doit voir le process partagé';
  assert (select actor from public.shared_with_me()) = 'Achats', 'ÉCHEC : B doit voir son acteur';
  assert (select owner_username from public.shared_with_me()) = 'julie.martin', 'ÉCHEC : B doit voir qui partage';
end $$;

-- B donne son avis, le change, et ne peut pas écrire au nom d'un autre.
insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's2', 'valide');
insert into public.step_reviews (process_id, step_id, status, comment)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's3', 'a_revoir', 'Le délai est plutôt de 3 JO.');
insert into public.step_reviews (process_id, step_id, status, comment)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's2', 'a_revoir', 'Il manque la signature.')
  on conflict (process_id, member_id, step_id) do update set status = excluded.status, comment = excluded.comment;
do $$ begin
  assert (select status from public.step_reviews where step_id = 's2') = 'a_revoir', 'ÉCHEC : B doit pouvoir changer son avis';
end $$;
select pg_temp.refuse($$insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's4', 'a_revoir')$$, '« à revoir » sans commentaire');
select pg_temp.refuse($$insert into public.step_reviews (process_id, member_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 's4', 'valide')$$,
  'un avis au nom d''un autre membre');

-- D (autre membre) ne voit pas les avis de B, et donne le sien.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  assert (select count(*) from public.step_reviews) = 0, 'ÉCHEC : D ne doit pas voir les avis de B';
end $$;
insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's2', 'valide');
update public.step_reviews set comment = 'Changé par D' where member_id = '22222222-2222-2222-2222-222222222222';
delete from public.step_reviews where member_id = '22222222-2222-2222-2222-222222222222';

-- C (ni propriétaire ni membre) : rien à lire, rien à écrire.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  assert (select count(*) from public.shared_with_me()) = 0, 'ÉCHEC : C ne doit voir aucun process partagé';
  assert (select count(*) from public.step_reviews) = 0, 'ÉCHEC : C ne doit voir aucun avis';
end $$;
select pg_temp.refuse($$insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's2', 'valide')$$, 'un avis sans être membre');

-- A (propriétaire) lit tous les avis, sans pouvoir les changer.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.step_reviews set status = 'valide';
do $$ begin
  assert (select count(*) from public.step_reviews) = 3, 'ÉCHEC : A doit lire les avis de B et D';
  assert (select comment from public.step_reviews where member_id = '22222222-2222-2222-2222-222222222222' and step_id = 's2')
    = 'Il manque la signature.', 'ÉCHEC : D ou A a changé l''avis de B';
  assert (select count(*) from public.step_reviews where status = 'a_revoir') = 2, 'ÉCHEC : A a changé un avis';
  assert (select count(*) from public.shared_with_me()) = 0, 'ÉCHEC : ses propres process ne sont pas « partagés avec moi »';
end $$;

-- Sans connexion (anon) : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.step_reviews', 'lire les avis sans être connecté');
select pg_temp.refuse('select * from public.shared_with_me()', 'lister les partages sans être connecté');
reset role;

-- A retire B : ses avis partent avec lui ; supprimer le process retire le reste.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
delete from public.process_members where member_id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from public.step_reviews) = 1, 'ÉCHEC : les avis d''un membre retiré doivent partir';
end $$;
delete from public.processes;
reset role;
do $$ begin
  assert (select count(*) from public.step_reviews) = 0, 'ÉCHEC : les avis d''un process supprimé doivent partir';
end $$;

\echo 'Avis sur un process partagé : tout est conforme.'
