-- Test : les liens de consultation (formulaire, workflow, ou les deux), lus
-- sans compte par leur jeton seulement. Sur un PostgreSQL vide (pas sur le
-- projet Supabase : ce script crée de faux comptes).
--
--   psql -d base_de_test -v ON_ERROR_STOP=1 -f supabase/tests/liens_consultation_rls.sql
--
-- A (propriétaire des liens), B (un autre compte), et un visiteur sans compte.

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
\ir ../migrations/20261126000000_liens_consultation.sql
-- Relancer le script ne doit rien casser.
\ir ../migrations/20261126000000_liens_consultation.sql

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'b@exemple.fr');

-- Échoue si `sql` passe, au lieu d'être refusé avec le code attendu.
create function pg_temp.refuse(sql text, code text, why text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ÉCHEC : % aurait dû être refusé', why;
exception
  when others then
    if sqlstate <> code then
      raise exception 'ÉCHEC : % refusé avec le code % au lieu de % (%)', why, sqlstate, code, sqlerrm;
    end if;
end;
$$;

-- A crée trois liens, un de chaque sorte, en essayant de choisir jeton et date.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.profiles (id, first_name, last_name, username)
  values ('11111111-1111-1111-1111-111111111111', 'Inès', 'Moreau', 'ines.moreau');
insert into public.view_links (kind, title, content, note, token, expires_at) values
  ('form', 'Demande de matériel', '{"form": {"questions": []}}', 'Essayez de le remplir', 'jeton-choisi', now() + interval '10 years');
insert into public.view_links (kind, title, content) values
  ('workflow', 'Accueil d''un arrivant', '{"workflow": {"kind": "process", "source": "a.drawio", "process": {}}}'),
  ('form_workflow', 'Achat de fournitures', '{"form": {"questions": []}, "workflow": {"kind": "situations", "source": "b.xlsx", "situations": []}}');

-- La sorte doit correspondre à la copie, et le titre n'est pas vide.
select pg_temp.refuse($$insert into public.view_links (kind, title, content) values ('form', 'X', '{"workflow": {}}')$$,
  '23514', 'un formulaire sans formulaire');
select pg_temp.refuse($$insert into public.view_links (kind, title, content) values ('form_workflow', 'X', '{"form": {}}')$$,
  '23514', 'un formulaire + workflow sans workflow');
select pg_temp.refuse($$insert into public.view_links (kind, title, content) values ('autre', 'X', '{"form": {}}')$$,
  '23514', 'une sorte inconnue');
select pg_temp.refuse($$insert into public.view_links (kind, title, content) values ('form', '  ', '{"form": {}}')$$,
  '23514', 'un titre vide');
-- A ne crée pas de lien au nom de B.
select pg_temp.refuse($$insert into public.view_links (owner_id, kind, title, content)
  values ('22222222-2222-2222-2222-222222222222', 'form', 'X', '{"form": {}}')$$, '42501', 'créer un lien pour B');
-- A ne change pas un lien à la main (ni sa date de fin).
select pg_temp.refuse($$update public.view_links set expires_at = now() + interval '1 year'$$, '42501',
  'A écrit une date à la main');

do $$ begin
  assert (select count(*) from public.view_links) = 3, 'ÉCHEC : A voit ses trois liens';
  assert (select count(*) from public.view_links where token = 'jeton-choisi') = 0, 'ÉCHEC : le jeton est tiré par la base';
  assert (select bool_and(length(token) = 64) from public.view_links), 'ÉCHEC : jeton de 64 caractères';
  assert (select bool_and(expires_at between now() + interval '29 days' and now() + interval '31 days') from public.view_links),
    'ÉCHEC : un lien vaut 30 jours, même si on demande plus';
end $$;
reset role;

select token as jeton, id as lien from public.view_links where kind = 'form' \gset
select set_config('test.jeton', :'jeton', false);
select set_config('test.lien', :'lien', false);

-- B ne voit pas, ne retire pas et ne prolonge pas les liens de A.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.view_links) = 0, 'ÉCHEC : B ne voit pas les liens de A';
end $$;
delete from public.view_links;
select pg_temp.refuse($$select public.view_link_extend(current_setting('test.lien')::uuid)$$, '42501', 'B prolonge le lien de A');
reset role;
do $$ begin
  assert (select count(*) from public.view_links) = 3, 'ÉCHEC : B n''a rien retiré';
end $$;

-- Le visiteur sans compte : il ouvre un lien par son jeton, rien d'autre.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v record;
begin
  select * into v from public.view_link_open(current_setting('test.jeton'));
  assert v.kind = 'form' and v.title = 'Demande de matériel' and v.note = 'Essayez de le remplir',
    'ÉCHEC : le lien s''ouvre avec son contenu';
  assert v.owner_first_name = 'Inès' and v.owner_username = 'ines.moreau', 'ÉCHEC : le nom de celui qui envoie';
  assert v.content ? 'form', 'ÉCHEC : la copie du formulaire';
end $$;
-- Les espaces autour du jeton (copier-coller) ne gênent pas.
do $$ begin
  assert (select count(*) from public.view_link_open('  ' || current_setting('test.jeton') || ' ')) = 1,
    'ÉCHEC : jeton avec des espaces';
end $$;
select pg_temp.refuse($$select * from public.view_link_open('pas-un-jeton')$$, 'P0002', 'ouvrir un jeton inconnu');
select pg_temp.refuse($$select * from public.view_link_open(null)$$, 'P0002', 'ouvrir sans jeton');
select pg_temp.refuse($$select * from public.view_links$$, '42501', 'lire la table sans compte');
select pg_temp.refuse($$insert into public.view_links (kind, title, content) values ('form', 'X', '{"form": {}}')$$,
  '42501', 'créer un lien sans compte');
select pg_temp.refuse($$select public.view_link_extend(current_setting('test.lien')::uuid)$$, '42501', 'prolonger sans compte');
reset role;

-- Le lien expire : il ne s'ouvre plus.
update public.view_links set expires_at = now() - interval '1 minute' where id = :'lien';
set role anon;
select pg_temp.refuse($$select * from public.view_link_open(current_setting('test.jeton'))$$, 'SF410', 'ouvrir un lien expiré');
reset role;

-- A le prolonge : 30 jours à partir d'aujourd'hui, et il se rouvre.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert public.view_link_extend(current_setting('test.lien')::uuid) between now() + interval '29 days' and now() + interval '31 days',
    'ÉCHEC : la prolongation donne 30 jours';
end $$;
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.view_link_open(current_setting('test.jeton'))) = 1, 'ÉCHEC : le lien prolongé s''ouvre';
end $$;
reset role;

-- A retire le lien : il ne s'ouvre plus.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
delete from public.view_links where id = current_setting('test.lien')::uuid;
reset role;
set role anon;
select pg_temp.refuse($$select * from public.view_link_open(current_setting('test.jeton'))$$, 'P0002', 'ouvrir un lien retiré');
reset role;

-- Au plus 100 liens par compte.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.view_links (kind, title, content)
  select 'form', 'Lien ' || n, '{"form": {}}' from generate_series(1, 98) as n;
select pg_temp.refuse($$insert into public.view_links (kind, title, content) values ('form', 'Le 101e', '{"form": {}}')$$,
  'SF429', 'créer un 101e lien');
reset role;

-- Les liens partent avec le compte.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.view_links) = 0, 'ÉCHEC : les liens partent avec le compte';
end $$;

\echo 'Liens de consultation : tout est conforme.'
