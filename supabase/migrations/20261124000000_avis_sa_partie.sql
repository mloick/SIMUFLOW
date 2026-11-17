-- SimuFlow : chacun ne donne son avis que sur sa partie.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
-- Demande d'abord les avis et les liens d'acteur (20261118000000_avis.sql,
-- 20261119000000_liens_acteurs.sql).
--
-- Avant, l'écran n'ouvrait que « Ma partie », mais le serveur acceptait un avis
-- sur n'importe quelle étape du process : en appelant le serveur directement,
-- l'acteur « Achats » pouvait valider une étape de « Finance ».
--
-- Règle, la même que dans l'app (src/domain/review.ts, canReviewStep) :
-- - on ne donne un avis que sur une étape à relire (ni départ, ni fin) ;
-- - avec un acteur confié, seulement sur les étapes de cet acteur
--   (« Achats » = « achats » : majuscules, accents et espaces ignorés) ;
-- - sans acteur confié, ou si l'acteur n'a plus d'étape dans le schéma (le
--   chef l'a renommé), tout le process est à relire, comme avant.
-- Les étapes des autres restent lisibles : un souci venu d'une étape d'avant
-- s'explique dans le commentaire de sa propre étape.
--
-- Les avis déjà donnés ne sont pas touchés ; chacun peut toujours retirer les siens.

-- 1. Nom d'acteur comparable ----------------------------------------------------------
-- Minuscules, sans accents, espaces simples, comme `normalize` dans l'app.

create or replace function public.actor_key(p_actor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(translate(coalesce(p_actor, ''),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUYY')), '\s+', ' ', 'g'));
$$;

-- 2. L'étape fait-elle partie de ce que cet acteur relit ? ------------------------------
-- « security definer » : lit le schéma du process sans repasser par ses règles.

create or replace function public.is_step_of_actor(p_process uuid, p_step text, p_actor text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with steps as (
    select s ->> 'id' as id, public.actor_key(s ->> 'actor') as actor
    from public.processes p, jsonb_array_elements(p.content -> 'steps') s
    where p.id = p_process and coalesce(s ->> 'kind', 'task') not in ('start', 'end')
  )
  select case
    when not exists (select 1 from steps where id = p_step) then false
    when public.actor_key(p_actor) = '' then true
    when not exists (select 1 from steps where actor = public.actor_key(p_actor)) then true
    else exists (select 1 from steps where id = p_step and actor = public.actor_key(p_actor))
  end;
$$;

revoke all on function public.is_step_of_actor(uuid, text, text) from public, anon;
grant execute on function public.is_step_of_actor(uuid, text, text) to authenticated;

-- Pour un membre avec un compte : l'acteur qui lui est confié.
create or replace function public.is_my_step(p_process uuid, p_step text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.process_members m
    where m.process_id = p_process and m.member_id = (select auth.uid())
      and public.is_step_of_actor(p_process, p_step, m.actor)
  );
$$;

revoke all on function public.is_my_step(uuid, text) from public, anon;
grant execute on function public.is_my_step(uuid, text) to authenticated;

-- 3. Membres avec un compte ---------------------------------------------------------------

drop policy if exists "Donner son avis" on public.step_reviews;
create policy "Donner son avis" on public.step_reviews
  for insert to authenticated
  with check (member_id = (select auth.uid()) and public.is_my_step(process_id, step_id));

drop policy if exists "Changer son avis" on public.step_reviews;
create policy "Changer son avis" on public.step_reviews
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()) and public.is_my_step(process_id, step_id));

-- 4. Liens d'acteur (sans compte) --------------------------------------------------------
-- Même fonction qu'avant, avec la vérification de la partie en plus.
-- Codes d'erreur lus par l'app : P0002 (lien inconnu), 22023 (étape disparue),
-- 42501 (pas sa partie).

create or replace function public.link_review(
  p_token text, p_name text, p_step text, p_status text, p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.actor_links;
begin
  select * into v_link from public.actor_links l where l.token = btrim(coalesce(p_token, ''));
  if v_link.id is null then
    raise exception 'Ce lien n''existe pas ou a été retiré.' using errcode = 'P0002';
  end if;
  -- L'étape doit exister dans le process (code d'avant, gardé).
  if not exists (
    select 1 from public.processes p, jsonb_array_elements(p.content -> 'steps') s
    where p.id = v_link.process_id and s ->> 'id' = p_step
  ) then
    raise exception 'Cette étape n''est pas dans le process.' using errcode = '22023';
  end if;
  if not public.is_step_of_actor(v_link.process_id, p_step, v_link.actor) then
    raise exception 'Cette étape ne fait pas partie de votre partie.' using errcode = '42501';
  end if;
  insert into public.link_reviews as r (link_id, step_id, status, comment, reviewer_name)
  values (v_link.id, p_step, p_status, nullif(btrim(coalesce(p_comment, '')), ''), btrim(coalesce(p_name, '')))
  on conflict (link_id, step_id) do update
    set status = excluded.status, comment = excluded.comment, reviewer_name = excluded.reviewer_name, updated_at = now();
end;
$$;

revoke all on function public.link_review(text, text, text, text, text) from public;
grant execute on function public.link_review(text, text, text, text, text) to anon, authenticated;
