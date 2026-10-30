-- Test des règles de sécurité de la table des process, sur un PostgreSQL vide
-- (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/processes_rls.sql
--
-- Il imite ce que Supabase fournit (rôles anon et authenticated, auth.users,
-- auth.uid() qui lit le compte connecté), applique la migration, puis vérifie
-- chaque règle. Une règle non respectée arrête le script avec « ÉCHEC ».

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
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261030150000_processes.sql

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

-- Compte A connecté.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.processes (name, content) values ('Process de A', '{"steps": [], "links": []}');

do $$ begin
  assert (select count(*) from public.processes) = 1, 'ÉCHEC : A doit voir son process';
  assert (select owner_id from public.processes) = auth.uid(), 'ÉCHEC : owner_id doit être rempli tout seul';
end $$;

select pg_temp.refuse(
  $$insert into public.processes (name, owner_id, content)
    values ('Usurpation', '22222222-2222-2222-2222-222222222222', '{"steps": [], "links": []}')$$,
  'créer un process au nom d''un autre compte');
select pg_temp.refuse($$insert into public.processes (name, content) values ('Mauvais', '{"steps": {}}')$$,
  'un contenu sans listes steps et links');
select pg_temp.refuse($$insert into public.processes (name, content) values ('   ', '{"steps": [], "links": []}')$$,
  'un nom vide');
select pg_temp.refuse($$update public.processes set owner_id = '22222222-2222-2222-2222-222222222222'$$,
  'donner son process à un autre compte');

-- Compte B connecté : ne voit rien, ne change rien.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
update public.processes set name = 'Piraté';
delete from public.processes;
do $$ begin
  assert (select count(*) from public.processes) = 0, 'ÉCHEC : B ne doit pas voir le process de A';
end $$;

-- Sans connexion (anon) : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.processes', 'lire sans être connecté');

-- Vu par l'administrateur : le process de A est intact.
reset role;
do $$ begin
  assert (select name from public.processes) = 'Process de A', 'ÉCHEC : B a modifié le process de A';
end $$;

-- Supprimer le compte A supprime ses process.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.processes) = 0, 'ÉCHEC : les process d''un compte supprimé doivent partir';
end $$;

\echo 'Règles de sécurité des process : tout est conforme.'
