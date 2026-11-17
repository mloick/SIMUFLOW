-- SimuFlow : un lien d'acteur expire 30 jours après sa création.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
-- Demande d'abord 20261119000000_liens_acteurs.sql et
-- 20261124000000_avis_sa_partie.sql.
--
-- Principe :
-- - Chaque lien a une date de fin (expires_at). Un nouveau lien vaut 30 jours ;
--   les liens déjà créés reçoivent 30 jours à partir de ce script.
-- - Après cette date, la page du lien ne s'ouvre plus et n'accepte plus
--   d'avis (code SF410, lu par l'app). Les avis déjà donnés restent visibles
--   pour le propriétaire et l'équipe.
-- - Le propriétaire du process peut prolonger un lien de 30 jours à partir
--   d'aujourd'hui (link_extend). Il ne peut pas choisir une date plus lointaine.

-- 1. La date de fin -------------------------------------------------------------------

alter table public.actor_links
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

comment on column public.actor_links.expires_at is 'Après cette date, le lien ne s''ouvre plus. Prolongeable par le propriétaire.';

-- 2. Lire un lien par son jeton, en refusant un lien retiré ou expiré ------------------
-- Codes d'erreur lus par l'app : P0002 (lien inconnu ou retiré), SF410 (lien expiré).

create or replace function public.valid_link(p_token text)
returns public.actor_links
language plpgsql
stable
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
  if v_link.expires_at <= now() then
    raise exception 'Ce lien a expiré.' using errcode = 'SF410';
  end if;
  return v_link;
end;
$$;

-- Appelée seulement par les fonctions du lien ci-dessous.
revoke all on function public.valid_link(text) from public, anon, authenticated;

-- 3. Les trois fonctions de la page du lien, redéfinies avec valid_link ---------------

create or replace function public.link_open(p_token text)
returns table (
  process_name text,
  content jsonb,
  actor text,
  owner_first_name text,
  owner_last_name text,
  owner_username text,
  reviews jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.actor_links := public.valid_link(p_token);
begin
  return query
    select p.name, p.content, v_link.actor, pr.first_name, pr.last_name, pr.username,
      coalesce(
        (select jsonb_agg(jsonb_build_object(
            'step_id', r.step_id, 'status', r.status, 'comment', r.comment, 'reviewer_name', r.reviewer_name))
          from public.link_reviews r where r.link_id = v_link.id),
        '[]'::jsonb)
    from public.processes p
    left join public.profiles pr on pr.id = p.owner_id
    where p.id = v_link.process_id;
end;
$$;

create or replace function public.link_review(
  p_token text, p_name text, p_step text, p_status text, p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.actor_links := public.valid_link(p_token);
begin
  -- L'étape doit exister dans le process.
  if not exists (
    select 1 from public.processes p, jsonb_array_elements(p.content -> 'steps') s
    where p.id = v_link.process_id and s ->> 'id' = p_step
  ) then
    raise exception 'Cette étape n''est pas dans le process.' using errcode = '22023';
  end if;
  -- Et faire partie de la partie de l'acteur du lien (20261124000000_avis_sa_partie.sql).
  if not public.is_step_of_actor(v_link.process_id, p_step, v_link.actor) then
    raise exception 'Cette étape ne fait pas partie de votre partie.' using errcode = '42501';
  end if;
  insert into public.link_reviews as r (link_id, step_id, status, comment, reviewer_name)
  values (v_link.id, p_step, p_status, nullif(btrim(coalesce(p_comment, '')), ''), btrim(coalesce(p_name, '')))
  on conflict (link_id, step_id) do update
    set status = excluded.status, comment = excluded.comment, reviewer_name = excluded.reviewer_name, updated_at = now();
end;
$$;

create or replace function public.link_unreview(p_token text, p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.actor_links := public.valid_link(p_token);
begin
  delete from public.link_reviews r where r.link_id = v_link.id and r.step_id = p_step;
end;
$$;

revoke all on function public.link_open(text) from public;
revoke all on function public.link_review(text, text, text, text, text) from public;
revoke all on function public.link_unreview(text, text) from public;
grant execute on function public.link_open(text) to anon, authenticated;
grant execute on function public.link_review(text, text, text, text, text) to anon, authenticated;
grant execute on function public.link_unreview(text, text) to anon, authenticated;

-- 4. Prolonger un lien (propriétaire du process seulement) ----------------------------
-- Code d'erreur : 42501 (pas son lien, ou lien inconnu).

create or replace function public.link_extend(p_link uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if not public.is_link_owner(p_link) then
    raise exception 'Seul le propriétaire du process peut prolonger ce lien.' using errcode = '42501';
  end if;
  update public.actor_links set expires_at = now() + interval '30 days'
  where id = p_link
  returning expires_at into v_until;
  return v_until;
end;
$$;

revoke all on function public.link_extend(uuid) from public, anon;
grant execute on function public.link_extend(uuid) to authenticated;
