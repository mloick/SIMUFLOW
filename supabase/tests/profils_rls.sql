-- Test des règles de sécurité de la table des profils, sur un PostgreSQL vide
-- (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/profils_rls.sql
--
-- Même principe que processes_rls.sql : imitation minimale de Supabase,
-- migrations appliquées, puis chaque règle vérifiée avec deux comptes.

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

-- La table des profils réutilise la fonction set_updated_at de la table des process.
\ir ../migrations/20261030150000_processes.sql
\ir ../migrations/20261116000000_profils.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261116000000_profils.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Échoue si `sql` passe, au lieu d'être refusé.
create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or check_violation or with_check_option_violation or unique_violation then null;
end;
$$;

-- Compte A connecté : crée puis modifie son profil (comme l'app, par upsert).
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.profiles (first_name, last_name, username) values ('Julie', 'Martin', 'julie.martin');
insert into public.profiles (id, first_name, last_name, username, role)
  values ('11111111-1111-1111-1111-111111111111', 'Julie', 'Martin', 'julie.martin', 'chef_de_projet')
  on conflict (id) do update set role = excluded.role;

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'ÉCHEC : A doit voir son profil, un seul';
  assert (select id from public.profiles) = auth.uid(), 'ÉCHEC : id doit être rempli tout seul';
  assert (select role from public.profiles) = 'chef_de_projet', 'ÉCHEC : l''upsert doit changer le rôle';
end $$;

select pg_temp.refuse(
  $$insert into public.profiles (id, first_name, last_name, username)
    values ('22222222-2222-2222-2222-222222222222', 'Faux', 'Profil', 'faux.profil')$$,
  'créer un profil au nom d''un autre compte');
select pg_temp.refuse($$update public.profiles set username = 'Julie Martin'$$, 'un identifiant avec majuscule et espace');
select pg_temp.refuse($$update public.profiles set username = 'jm'$$, 'un identifiant de moins de 3 caractères');
select pg_temp.refuse($$update public.profiles set first_name = '  '$$, 'un prénom vide');
select pg_temp.refuse($$update public.profiles set role = 'administrateur'$$, 'un rôle inconnu');
select pg_temp.refuse($$update public.profiles set id = '22222222-2222-2222-2222-222222222222'$$,
  'donner son profil à un autre compte');

-- Compte B connecté : ne voit pas le profil de A, ne peut ni le changer ni prendre son identifiant.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
update public.profiles set last_name = 'Piraté';
delete from public.profiles;
do $$ begin
  assert (select count(*) from public.profiles) = 0, 'ÉCHEC : B ne doit pas voir le profil de A';
end $$;
select pg_temp.refuse(
  $$insert into public.profiles (first_name, last_name, username) values ('Autre', 'Personne', 'julie.martin')$$,
  'prendre l''identifiant d''un autre compte');
insert into public.profiles (first_name, last_name, username) values ('Karim', 'Benali', 'karim.benali');

-- Sans connexion (anon) : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.profiles', 'lire sans être connecté');

-- Vu par l'administrateur : le profil de A est intact.
reset role;
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'ÉCHEC : il doit rester deux profils';
  assert (select last_name from public.profiles where username = 'julie.martin') = 'Martin',
    'ÉCHEC : B a modifié le profil de A';
end $$;

-- Supprimer le compte A supprime son profil.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'ÉCHEC : le profil d''un compte supprimé doit partir';
end $$;

\echo 'Règles de sécurité des profils : tout est conforme.'
