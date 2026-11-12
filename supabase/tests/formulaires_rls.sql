-- Test des règles de sécurité de la table des formulaires gardés, sur un
-- PostgreSQL vide (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/formulaires_rls.sql
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

-- La table des formulaires réutilise la fonction set_updated_at de la table des process.
\ir ../migrations/20261030150000_processes.sql
\ir ../migrations/20261112230000_formulaires.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261112230000_formulaires.sql

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
insert into public.saved_forms (forms) values ('[{"id": "formulaire-1", "form": {"questions": []}, "source": "template.xlsx"}]');
insert into public.saved_forms (owner_id, forms)
  values ('11111111-1111-1111-1111-111111111111', '[]')
  on conflict (owner_id) do update set forms = excluded.forms;

do $$ begin
  assert (select count(*) from public.saved_forms) = 1, 'ÉCHEC : A doit voir sa ligne, une seule';
  assert (select owner_id from public.saved_forms) = auth.uid(), 'ÉCHEC : owner_id doit être rempli tout seul';
  assert (select jsonb_array_length(forms) from public.saved_forms) = 0, 'ÉCHEC : l''upsert doit remplacer les formulaires';
end $$;

select pg_temp.refuse(
  $$insert into public.saved_forms (owner_id, forms) values ('22222222-2222-2222-2222-222222222222', '[]')$$,
  'créer des formulaires au nom d''un autre compte');
select pg_temp.refuse($$update public.saved_forms set forms = '{"id": "formulaire-1"}'$$, 'des formulaires qui ne sont pas une liste');
select pg_temp.refuse(
  $$update public.saved_forms set forms = (select jsonb_agg(jsonb_build_object('id', n)) from generate_series(1, 201) n)$$,
  'plus de 200 formulaires');
select pg_temp.refuse($$update public.saved_forms set owner_id = '22222222-2222-2222-2222-222222222222'$$,
  'donner ses formulaires à un autre compte');

-- Compte B connecté : ne voit rien, ne change rien.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
update public.saved_forms set forms = '[{"id": "piraté"}]';
delete from public.saved_forms;
do $$ begin
  assert (select count(*) from public.saved_forms) = 0, 'ÉCHEC : B ne doit pas voir les formulaires de A';
end $$;

-- Sans connexion (anon) : aucun accès.
reset role;
set role anon;
select pg_temp.refuse('select * from public.saved_forms', 'lire sans être connecté');

-- Vu par l'administrateur : la ligne de A est intacte.
reset role;
do $$ begin
  assert (select count(*) from public.saved_forms) = 1, 'ÉCHEC : B a supprimé les formulaires de A';
  assert (select jsonb_array_length(forms) from public.saved_forms) = 0, 'ÉCHEC : B a modifié les formulaires de A';
end $$;

-- Supprimer le compte A supprime ses formulaires.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.saved_forms) = 0, 'ÉCHEC : les formulaires d''un compte supprimé doivent partir';
end $$;

\echo 'Règles de sécurité des formulaires gardés : tout est conforme.'
