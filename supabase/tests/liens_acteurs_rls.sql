-- Test des liens d'acteur (relire sa partie sans compte), sur un PostgreSQL
-- vide (pas sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/liens_acteurs_rls.sql
--
-- A (propriétaire), C (un autre compte), et un visiteur sans compte (anon).

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
\ir ../migrations/20261119000000_liens_acteurs.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261119000000_liens_acteurs.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('33333333-3333-3333-3333-333333333333', 'c@exemple.fr');

create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or check_violation or with_check_option_violation or no_data_found
    or invalid_parameter_value or not_null_violation then null;
end;
$$;

set role authenticated;

-- A crée un process et un lien pour « Achats ».
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.profiles (first_name, last_name, username) values ('Julie', 'Martin', 'julie.martin');
insert into public.processes (id, name, content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Demande de matériel',
  '{"steps": [{"id": "s3", "kind": "task", "title": "Passer la commande", "actor": "Achats"}], "links": []}');
insert into public.actor_links (process_id, actor) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Achats');
do $$ begin
  assert (select char_length(token) from public.actor_links) = 64, 'ÉCHEC : le jeton doit faire 64 caractères';
end $$;
select pg_temp.refuse($$insert into public.link_reviews (link_id, step_id, status, reviewer_name)
  select id, 's3', 'valide', 'A' from public.actor_links$$, 'écrire un avis de lien sans la fonction');
reset role;
select token as jeton from public.actor_links \gset
set role authenticated;

-- C (autre compte) : ne voit pas le lien, ne peut pas en créer sur le process de A.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  assert (select count(*) from public.actor_links) = 0, 'ÉCHEC : C ne doit pas voir les liens de A';
end $$;
select pg_temp.refuse($$insert into public.actor_links (process_id, actor)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Logistique')$$, 'créer un lien sur le process d''un autre');

-- Le visiteur sans compte : ouvre le lien, donne son avis avec son nom, le change, le retire.
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.refuse('select * from public.actor_links', 'lire les liens sans compte');
select pg_temp.refuse('select * from public.link_reviews', 'lire les avis sans compte');
select pg_temp.refuse('select * from public.processes', 'lire les process sans compte');
select pg_temp.refuse($$select * from public.link_open('mauvais-jeton')$$, 'ouvrir un lien inconnu');
select set_config('test.jeton', :'jeton', false);
do $$ begin
  assert (select process_name from public.link_open(current_setting('test.jeton'))) = 'Demande de matériel',
    'ÉCHEC : le lien doit ouvrir le process';
  assert (select actor from public.link_open(current_setting('test.jeton'))) = 'Achats', 'ÉCHEC : l''acteur du lien';
  assert (select owner_username from public.link_open(current_setting('test.jeton'))) = 'julie.martin',
    'ÉCHEC : le nom de qui partage';
end $$;
select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's3', 'a_revoir', 'Il faut deux devis.');
select pg_temp.refuse($$select public.link_review(current_setting('test.jeton'), 'Karim', 's9', 'valide')$$,
  'un avis sur une étape qui n''existe pas');
select pg_temp.refuse($$select public.link_review(current_setting('test.jeton'), '  ', 's3', 'valide')$$,
  'un avis sans nom');
select pg_temp.refuse($$select public.link_review(current_setting('test.jeton'), 'Karim', 's3', 'a_revoir', ' ')$$,
  '« à revoir » sans commentaire');
select pg_temp.refuse($$select public.link_review('mauvais-jeton', 'Karim', 's3', 'valide')$$,
  'un avis avec un mauvais jeton');
do $$ begin
  assert (select reviews -> 0 ->> 'reviewer_name' from public.link_open(current_setting('test.jeton'))) = 'Karim Benali',
    'ÉCHEC : l''avis doit garder le nom';
end $$;
select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's3', 'valide');
do $$ begin
  assert (select reviews -> 0 ->> 'status' from public.link_open(current_setting('test.jeton'))) = 'valide',
    'ÉCHEC : l''avis doit changer';
end $$;
select public.link_unreview('mauvais-jeton', 's3');
reset role;
do $$ begin
  assert (select count(*) from public.link_reviews) = 1, 'ÉCHEC : un mauvais jeton ne retire rien';
end $$;

-- A lit l'avis du lien ; C ne le lit pas.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert (select reviewer_name from public.link_reviews) = 'Karim Benali', 'ÉCHEC : A doit lire l''avis du lien';
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  assert (select count(*) from public.link_reviews) = 0, 'ÉCHEC : C ne doit pas lire l''avis du lien';
end $$;

-- A retire le lien : il ne s'ouvre plus et ses avis partent.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
delete from public.actor_links;
reset role;
do $$ begin
  assert (select count(*) from public.link_reviews) = 0, 'ÉCHEC : les avis d''un lien retiré doivent partir';
end $$;
set role anon;
select pg_temp.refuse($$select * from public.link_open(current_setting('test.jeton'))$$, 'ouvrir un lien retiré');
reset role;

\echo 'Liens d''acteur : tout est conforme.'
