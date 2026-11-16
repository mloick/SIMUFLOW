-- Test du tableau de bord d'un projet : l'équipe lit les membres et les avis
-- des process du projet, sans pouvoir les changer. Sur un PostgreSQL vide (pas
-- sur le projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/tableau_de_bord_rls.sql
--
-- Quatre comptes : A (chef), B (collaborateur), C (relit le process de B,
-- hors équipe), D (hors de tout).

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
\ir ../migrations/20261119000000_liens_acteurs.sql
\ir ../migrations/20261122000000_tableau_de_bord.sql
\ir ../migrations/20261123000000_liens_equipe.sql
-- Relancer les migrations ne doit rien casser.
\ir ../migrations/20261122000000_tableau_de_bord.sql
\ir ../migrations/20261123000000_liens_equipe.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr'),
  ('33333333-3333-3333-3333-333333333333', 'c@exemple.fr'),
  ('44444444-4444-4444-4444-444444444444', 'd@exemple.fr');
insert into public.profiles (id, first_name, last_name, username) values
  ('33333333-3333-3333-3333-333333333333', 'Julie', 'Martin', 'julie.martin');

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', id, false);
$$;

set role authenticated;

-- A crée le projet et invite B.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.projects (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Migration du support');
select * from public.invite_to_project('aaaaaaaa-0000-4000-8000-000000000001', 'b@exemple.fr');

-- B range un process dans le projet, en garde un autre hors projet, et partage les deux avec C.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.processes (id, name, content, project_id) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Dans le projet', '{"steps": [], "links": []}', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Hors projet', '{"steps": [], "links": []}', null);
select * from public.invite_member('bbbbbbbb-0000-4000-8000-000000000001', 'julie.martin', 'Achats');
select * from public.invite_member('bbbbbbbb-0000-4000-8000-000000000002', 'julie.martin', 'Achats');

-- B crée aussi un lien pour « Logistique » (sans compte), et un autre sans avis.
update public.processes set content = '{"steps": [{"id": "livraison", "kind": "task", "title": "Livrer", "actor": "Logistique"}], "links": []}'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001';
insert into public.actor_links (process_id, actor) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Logistique'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Accueil');
reset role;
select public.link_review((select token from public.actor_links where actor = 'Logistique'),
  'Sami Aït', 'livraison', 'valide');
set role authenticated;

-- C donne son avis sur les deux.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
insert into public.step_reviews (process_id, step_id, status, comment) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'devis', 'a_revoir', 'Il faut deux devis'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'devis', 'valide', null);

-- A, chef, voit le membre et l'avis du process rangé dans son projet, pas de l'autre.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  assert (select count(*) from public.step_reviews) = 1, 'ÉCHEC : le chef lit les avis du process du projet, et eux seuls';
  assert (select comment from public.step_reviews) = 'Il faut deux devis', 'ÉCHEC : le chef lit le commentaire';
  assert (select count(*) from public.process_members) = 1, 'ÉCHEC : le chef voit qui relit le process du projet';
  assert (select first_name from public.members_of('bbbbbbbb-0000-4000-8000-000000000001')) = 'Julie',
    'ÉCHEC : le chef a le nom du membre';
  assert (select count(*) from public.members_of('bbbbbbbb-0000-4000-8000-000000000002')) = 0,
    'ÉCHEC : rien sur le process hors projet';
end $$;

-- A voit les liens et leurs avis par la fonction, sans jeton ; pas les tables.
do $$ begin
  assert (select count(*) from public.link_activity_of('bbbbbbbb-0000-4000-8000-000000000001')) = 2,
    'ÉCHEC : le chef voit les deux liens (un avec avis, un sans)';
  assert (select reviewer_name from public.link_activity_of('bbbbbbbb-0000-4000-8000-000000000001')
    where actor = 'Logistique') = 'Sami Aït', 'ÉCHEC : le chef voit l''avis donné par lien';
  assert (select step_id from public.link_activity_of('bbbbbbbb-0000-4000-8000-000000000001')
    where actor = 'Accueil') is null, 'ÉCHEC : un lien sans avis donne une ligne vide';
  assert (select count(*) from public.actor_links) = 0, 'ÉCHEC : le chef lit les jetons';
  assert (select count(*) from public.link_reviews) = 0, 'ÉCHEC : le chef lit la table des avis par lien';
  assert (select count(*) from public.link_activity_of('bbbbbbbb-0000-4000-8000-000000000002')) = 0,
    'ÉCHEC : rien sur le process hors projet';
end $$;

-- Le chef ne peut ni changer ni retirer l'avis de C (aucune ligne touchée).
update public.step_reviews set status = 'valide', comment = null;
delete from public.step_reviews;
delete from public.process_members;
do $$ begin
  assert (select status from public.step_reviews) = 'a_revoir', 'ÉCHEC : le chef a changé l''avis de C';
  assert (select count(*) from public.process_members) = 1, 'ÉCHEC : le chef a retiré le membre de C';
end $$;

-- D, hors du projet, ne voit rien.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
do $$ begin
  assert (select count(*) from public.step_reviews) = 0, 'ÉCHEC : D lit des avis';
  assert (select count(*) from public.process_members) = 0, 'ÉCHEC : D voit des membres';
  assert (select count(*) from public.members_of('bbbbbbbb-0000-4000-8000-000000000001')) = 0, 'ÉCHEC : D a des noms';
  assert (select count(*) from public.link_activity_of('bbbbbbbb-0000-4000-8000-000000000001')) = 0,
    'ÉCHEC : D voit les liens';
end $$;

-- Le process quitte le projet : le chef n'y voit plus rien.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
update public.processes set project_id = null where id = 'bbbbbbbb-0000-4000-8000-000000000001';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  assert (select count(*) from public.step_reviews) = 0, 'ÉCHEC : le chef lit encore les avis d''un process sorti du projet';
  assert (select count(*) from public.link_activity_of('bbbbbbbb-0000-4000-8000-000000000001')) = 0,
    'ÉCHEC : le chef voit encore les liens d''un process sorti du projet';
end $$;

\echo 'Tableau de bord : tout est conforme.'
