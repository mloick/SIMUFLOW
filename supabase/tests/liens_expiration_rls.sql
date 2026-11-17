-- Test : un lien d'acteur expire après 30 jours, et seul le propriétaire du
-- process le prolonge. Sur un PostgreSQL vide (pas sur le projet Supabase :
-- ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/liens_expiration_rls.sql
--
-- A (propriétaire), B (membre « Achats »), et un visiteur sans compte.

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

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr');

-- Un lien créé AVANT le script d'expiration : il doit recevoir 30 jours.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.processes (id, name, content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Demande de matériel',
  '{"steps": [
     {"id": "s1", "kind": "start", "title": "Demande reçue"},
     {"id": "s2", "kind": "task", "title": "Passer la commande", "actor": "Achats"},
     {"id": "s3", "kind": "end", "title": "Matériel livré"}],
   "links": []}');
select * from public.invite_member('aaaaaaaa-0000-0000-0000-000000000001', 'b@exemple.fr', 'Achats');
insert into public.actor_links (process_id, actor) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Achats');
reset role;

\ir ../migrations/20261125000000_liens_expiration.sql
-- Relancer le script ne doit rien casser.
\ir ../migrations/20261125000000_liens_expiration.sql

select id as lien, token as jeton from public.actor_links \gset

do $$ begin
  assert (select expires_at between now() + interval '29 days' and now() + interval '31 days' from public.actor_links),
    'ÉCHEC : un lien déjà créé reçoit 30 jours';
end $$;

-- Échoue si `sql` passe, au lieu d'être refusé avec le code attendu.
create function pg_temp.refuse(sql text, code text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when others then
    if sqlstate <> code then
      raise exception 'ÉCHEC : % refusé avec le code % au lieu de %', why, sqlstate, code;
    end if;
end;
$$;

-- Lien valable : le visiteur l'ouvre et donne son avis.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('test.jeton', :'jeton', false);
select set_config('test.lien', :'lien', false);
do $$ begin
  assert (select count(*) from public.link_open(current_setting('test.jeton'))) = 1, 'ÉCHEC : le lien valable s''ouvre';
end $$;
select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's2', 'valide');
-- La vérification interne n'est pas ouverte sans compte, ni la prolongation.
select pg_temp.refuse($$select public.valid_link(current_setting('test.jeton'))$$, '42501', 'appeler valid_link sans compte');
select pg_temp.refuse($$select public.link_extend(current_setting('test.lien')::uuid)$$, '42501', 'prolonger sans compte');
reset role;

-- Le lien expire.
update public.actor_links set expires_at = now() - interval '1 minute';

set role anon;
select pg_temp.refuse($$select * from public.link_open(current_setting('test.jeton'))$$, 'SF410', 'ouvrir un lien expiré');
select pg_temp.refuse($$select public.link_review(current_setting('test.jeton'), 'Karim Benali', 's2', 'a_revoir', 'Trop tard')$$,
  'SF410', 'donner un avis par un lien expiré');
select pg_temp.refuse($$select public.link_unreview(current_setting('test.jeton'), 's2')$$, 'SF410',
  'retirer un avis par un lien expiré');
-- Un jeton inconnu reste « inconnu ».
select pg_temp.refuse($$select * from public.link_open('pas-un-jeton')$$, 'P0002', 'ouvrir un jeton inconnu');
reset role;

-- B (membre, pas propriétaire) ne peut pas prolonger le lien.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.refuse($$select public.link_extend(current_setting('test.lien')::uuid)$$, '42501', 'B prolonge le lien');
-- Ni changer la date lui-même.
select pg_temp.refuse($$update public.actor_links set expires_at = now() + interval '1 year'$$, '42501',
  'B écrit une date à la main');

-- A prolonge : 30 jours à partir d'aujourd'hui, pas plus, et ne peut pas écrire la date à la main.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert public.link_extend(current_setting('test.lien')::uuid) between now() + interval '29 days' and now() + interval '31 days',
    'ÉCHEC : la prolongation donne 30 jours';
end $$;
select pg_temp.refuse($$update public.actor_links set expires_at = now() + interval '1 year'$$, '42501',
  'A écrit une date à la main');
reset role;

-- Le lien s'ouvre de nouveau, et l'avis donné avant l'expiration est toujours là.
set role anon;
do $$ begin
  assert (select jsonb_array_length(reviews) from public.link_open(current_setting('test.jeton'))) = 1,
    'ÉCHEC : le lien prolongé s''ouvre avec son avis';
end $$;
reset role;

do $$ begin
  assert (select expires_at < now() + interval '31 days' from public.actor_links), 'ÉCHEC : B n''a pas changé la date';
end $$;

\echo 'Expiration des liens : tout est conforme.'
