-- Test de la suppression de compte, sur un PostgreSQL vide (comme processes_rls.sql).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/suppression_compte.sql

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
\ir ../migrations/20261030170000_suppression_compte.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261030170000_suppression_compte.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege then null;
end;
$$;

-- A et B ont chacun un process.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.processes (name, content) values ('Process de A', '{"steps": [], "links": []}');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.processes (name, content) values ('Process de B', '{"steps": [], "links": []}');

-- Un compte connecté n'a toujours pas le droit de toucher à auth.users lui-même.
select pg_temp.refuse('delete from auth.users', 'effacer auth.users sans passer par la fonction');

-- Sans connexion : refusé (pas le droit d'appeler la fonction).
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.refuse('select public.delete_my_account()', 'supprimer un compte sans être connecté');

-- Connecté mais sans identité : refusé par la fonction.
reset role;
set role authenticated;
select pg_temp.refuse('select public.delete_my_account()', 'supprimer sans identité');

-- A supprime son compte : A et ses process partent, B reste intact.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'),
    'ÉCHEC : le compte A doit être supprimé';
  assert exists (select 1 from auth.users where id = '22222222-2222-2222-2222-222222222222'),
    'ÉCHEC : le compte B ne doit pas être touché';
  assert (select array_agg(name) from public.processes) = array['Process de B'],
    'ÉCHEC : seuls les process de A doivent partir';
end $$;

\echo 'Suppression de compte : tout est conforme.'
