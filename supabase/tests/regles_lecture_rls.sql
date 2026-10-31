-- Test des règles de sécurité de la table des règles de lecture, sur un
-- PostgreSQL vide (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/regles_lecture_rls.sql
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

-- La table des règles réutilise la fonction set_updated_at de la table des process.
\ir ../migrations/20261030150000_processes.sql
\ir ../migrations/20261031120000_regles_lecture.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261031120000_regles_lecture.sql

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

-- Compte A connecté : crée puis remplace sa ligne (comme l'app, par upsert).
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.reading_rules (rules) values ('[{"type": "actor", "from": "Serv. compta", "to": "Comptabilité"}]');
insert into public.reading_rules (owner_id, rules)
  values ('11111111-1111-1111-1111-111111111111', '[]')
  on conflict (owner_id) do update set rules = excluded.rules;

do $$ begin
  assert (select count(*) from public.reading_rules) = 1, 'ÉCHEC : A doit voir sa ligne, une seule';
  assert (select owner_id from public.reading_rules) = auth.uid(), 'ÉCHEC : owner_id doit être rempli tout seul';
  assert (select jsonb_array_length(rules) from public.reading_rules) = 0, 'ÉCHEC : l''upsert doit remplacer les règles';
end $$;

select pg_temp.refuse(
  $$insert into public.reading_rules (owner_id, rules) values ('22222222-2222-2222-2222-222222222222', '[]')$$,
  'créer des règles au nom d''un autre compte');
select pg_temp.refuse($$update public.reading_rules set rules = '{"type": "actor"}'$$, 'des règles qui ne sont pas une liste');
select pg_temp.refuse($$update public.reading_rules set owner_id = '22222222-2222-2222-2222-222222222222'$$,
  'donner ses règles à un autre compte');

-- Compte B connecté : ne voit rien, ne change rien.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
update public.reading_rules set rules = '[{"type": "actor", "from": "x", "to": "piraté"}]';
delete from public.reading_rules;
do $$ begin
  assert (select count(*) from public.reading_rules) = 0, 'ÉCHEC : B ne doit pas voir les règles de A';
end $$;

-- Sans connexion (anon) : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.reading_rules', 'lire sans être connecté');

-- Vu par l'administrateur : la ligne de A est intacte.
reset role;
do $$ begin
  assert (select count(*) from public.reading_rules) = 1, 'ÉCHEC : B a supprimé les règles de A';
  assert (select jsonb_array_length(rules) from public.reading_rules) = 0, 'ÉCHEC : B a modifié les règles de A';
end $$;

-- Supprimer le compte A supprime ses règles.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.reading_rules) = 0, 'ÉCHEC : les règles d''un compte supprimé doivent partir';
end $$;

\echo 'Règles de sécurité des règles de lecture : tout est conforme.'
