-- Test : chacun ne donne son avis que sur sa partie (membre avec un compte et
-- lien d'acteur), sur un PostgreSQL vide (pas sur le projet Supabase : ce
-- script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/avis_sa_partie_rls.sql
--
-- A (propriétaire), B (membre « Achats »), D (membre sans acteur),
-- E (membre « Logistique », acteur qui n'a pas d'étape), et un visiteur sans compte.

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
\ir ../migrations/20261124000000_avis_sa_partie.sql
-- Relancer la migration ne doit rien casser.
\ir ../migrations/20261124000000_avis_sa_partie.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr'),
  ('44444444-4444-4444-4444-444444444444', 'd@exemple.fr'),
  ('55555555-5555-5555-5555-555555555555', 'e@exemple.fr');

-- Échoue si `sql` passe, au lieu d'être refusé.
create function pg_temp.refuse(sql text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when insufficient_privilege or with_check_option_violation then null;
end;
$$;

-- Les noms d'acteur se comparent comme dans l'app.
do $$ begin
  assert public.actor_key('  Équipe   Achats ') = 'equipe achats', 'ÉCHEC : majuscules, accents et espaces ignorés';
end $$;

set role authenticated;

-- A crée un process : départ, une étape « achats » (écrite en minuscules), une étape Finance, une fin.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.profiles (first_name, last_name, username) values ('Julie', 'Martin', 'julie.martin');
insert into public.processes (id, name, content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Demande de matériel',
  '{"steps": [
     {"id": "s1", "kind": "start", "title": "Demande reçue"},
     {"id": "s2", "kind": "task", "title": "Passer la commande", "actor": "achats"},
     {"id": "s3", "kind": "task", "title": "Payer la facture", "actor": "Finance"},
     {"id": "s4", "kind": "end", "title": "Matériel livré"}],
   "links": []}');
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'b@exemple.fr', 'Achats');
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'd@exemple.fr');
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'e@exemple.fr', 'Logistique');
insert into public.actor_links (process_id, actor) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Achats');
reset role;
select token as jeton from public.actor_links \gset
set role authenticated;

-- B (Achats) : avis sur son étape, pas sur celle de Finance, ni sur le départ.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.step_reviews (process_id, step_id, status, comment)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's2', 'a_revoir', 'La facture d''avant n''a pas le montant.');
select pg_temp.refuse($$insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's3', 'valide')$$, 'B valide une étape de Finance');
select pg_temp.refuse($$insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's1', 'valide')$$, 'B valide le départ');
-- Il ne peut pas non plus déplacer son avis sur l'étape d'un autre.
select pg_temp.refuse($$update public.step_reviews set step_id = 's3'
  where process_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'B déplace son avis sur Finance');
-- Il change son avis et peut le retirer.
update public.step_reviews set status = 'valide', comment = null
  where process_id = 'aaaaaaaa-0000-0000-0000-000000000001' and step_id = 's2';
delete from public.step_reviews where step_id = 's2';

-- D (sans acteur) relit tout le process.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's2', 'valide'), ('aaaaaaaa-0000-0000-0000-000000000001', 's3', 'valide');

-- E (Logistique, plus aucune étape à ce nom) relit tout le process, comme dans l'app.
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's3', 'valide');
select pg_temp.refuse($$insert into public.step_reviews (process_id, step_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 's9', 'valide')$$, 'E valide une étape qui n''existe pas');

-- Le visiteur du lien « Achats » : son étape oui, celle de Finance non.
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('test.jeton', :'jeton', false);
select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's2', 'valide');
select pg_temp.refuse($$select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's3', 'valide')$$,
  'le lien Achats valide une étape de Finance');
select pg_temp.refuse($$select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's4', 'valide')$$,
  'le lien Achats valide la fin');
-- Les fonctions de vérification ne sont pas ouvertes sans compte.
select pg_temp.refuse($$select public.is_step_of_actor('aaaaaaaa-0000-0000-0000-000000000001', 's3', 'Finance')$$,
  'appeler la vérification sans compte');
reset role;

do $$ begin
  assert (select count(*) from public.step_reviews) = 3, 'ÉCHEC : 3 avis de membres attendus (D deux, E un)';
  assert (select count(*) from public.link_reviews) = 1, 'ÉCHEC : un seul avis de lien attendu (s2)';
  assert (select step_id from public.link_reviews) = 's2', 'ÉCHEC : l''avis du lien porte sur s2';
end $$;

\echo 'Avis sur sa partie : tout est conforme.'
