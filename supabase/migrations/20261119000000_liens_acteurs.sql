-- SimuFlow : un lien web par acteur, pour les personnes sans compte.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
-- Demande d'abord le partage et les avis (20261117000000_partage.sql,
-- 20261118000000_avis.sql).
--
-- Principe :
-- - Le propriétaire d'un process crée un lien pour un acteur du schéma
--   (« Achats »). Le lien contient un jeton secret de 64 caractères : qui a
--   le lien peut relire la partie de cet acteur, rien d'autre.
-- - La page du lien demande de confirmer qu'on est cet acteur en écrivant
--   son nom ; chaque avis garde ce nom. C'est une confirmation, pas une
--   preuve d'identité : le lien est à envoyer à la bonne personne.
-- - Sans compte (rôle anon), on ne passe que par trois fonctions qui
--   demandent le jeton : link_open, link_review, link_unreview. Les tables
--   elles-mêmes ne sont lisibles que par le propriétaire du process.
-- - Supprimer le lien (ou le process) retire les avis donnés par ce lien.

-- 1. Les liens ---------------------------------------------------------------------

create table if not exists public.actor_links (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  actor text not null check (char_length(btrim(actor)) between 1 and 200),
  -- 64 caractères hexadécimaux tirés au hasard (deux UUID v4) : impossible à deviner.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (process_id, actor)
);

comment on table public.actor_links is 'Lien web d''un acteur d''un process partagé, pour relire sa partie sans compte.';

alter table public.actor_links enable row level security;

revoke all on public.actor_links from anon;
grant select, insert, delete on public.actor_links to authenticated;

drop policy if exists "Voir les liens de ses process" on public.actor_links;
create policy "Voir les liens de ses process" on public.actor_links
  for select to authenticated
  using (public.is_process_owner(process_id));

drop policy if exists "Créer un lien sur ses process" on public.actor_links;
create policy "Créer un lien sur ses process" on public.actor_links
  for insert to authenticated
  with check (public.is_process_owner(process_id));

drop policy if exists "Retirer un lien de ses process" on public.actor_links;
create policy "Retirer un lien de ses process" on public.actor_links
  for delete to authenticated
  using (public.is_process_owner(process_id));

-- 2. Les avis donnés par un lien -------------------------------------------------------

create table if not exists public.link_reviews (
  link_id uuid not null references public.actor_links (id) on delete cascade,
  step_id text not null check (char_length(step_id) between 1 and 200),
  status text not null check (status in ('valide', 'a_revoir')),
  comment text check (comment is null or char_length(comment) <= 1000),
  -- Le nom écrit sur la page du lien pour confirmer qui relit.
  reviewer_name text not null check (char_length(btrim(reviewer_name)) between 1 and 80),
  updated_at timestamptz not null default now(),
  primary key (link_id, step_id),
  check (status = 'valide' or char_length(btrim(coalesce(comment, ''))) >= 1)
);

comment on table public.link_reviews is 'Avis donné sur une étape par la page d''un lien d''acteur, avec le nom confirmé.';

alter table public.link_reviews enable row level security;

revoke all on public.link_reviews from anon;
-- Lecture seule pour les comptes : on écrit par link_review, avec le jeton.
grant select on public.link_reviews to authenticated;

create or replace function public.is_link_owner(p_link uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actor_links l
    join public.processes p on p.id = l.process_id
    where l.id = p_link and p.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_link_owner(uuid) from public, anon;
grant execute on function public.is_link_owner(uuid) to authenticated;

drop policy if exists "Lire les avis des liens de ses process" on public.link_reviews;
create policy "Lire les avis des liens de ses process" on public.link_reviews
  for select to authenticated
  using (public.is_link_owner(link_id));

-- 3. La page du lien (sans compte) ---------------------------------------------------
-- Code d'erreur lu par l'app : P0002 (lien inconnu ou retiré).

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
  v_link public.actor_links;
begin
  select * into v_link from public.actor_links l where l.token = btrim(coalesce(p_token, ''));
  if v_link.id is null then
    raise exception 'Ce lien n''existe pas ou a été retiré.' using errcode = 'P0002';
  end if;
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
  v_link public.actor_links;
begin
  select * into v_link from public.actor_links l where l.token = btrim(coalesce(p_token, ''));
  if v_link.id is null then
    raise exception 'Ce lien n''existe pas ou a été retiré.' using errcode = 'P0002';
  end if;
  -- L'étape doit exister dans le process.
  if not exists (
    select 1 from public.processes p, jsonb_array_elements(p.content -> 'steps') s
    where p.id = v_link.process_id and s ->> 'id' = p_step
  ) then
    raise exception 'Cette étape n''est pas dans le process.' using errcode = '22023';
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
begin
  delete from public.link_reviews r
  using public.actor_links l
  where r.link_id = l.id and l.token = btrim(coalesce(p_token, '')) and r.step_id = p_step;
end;
$$;

revoke all on function public.link_open(text) from public;
revoke all on function public.link_review(text, text, text, text, text) from public;
revoke all on function public.link_unreview(text, text) from public;
grant execute on function public.link_open(text) to anon, authenticated;
grant execute on function public.link_review(text, text, text, text, text) to anon, authenticated;
grant execute on function public.link_unreview(text, text) to anon, authenticated;
