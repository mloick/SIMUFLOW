-- SimuFlow : le membre d'un process partagé relit sa partie, étape par étape.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
-- Demande d'abord le partage (20261117000000_partage.sql).
--
-- Principe :
-- - Un membre voit la liste des process partagés avec lui (shared_with_me),
--   avec le nom de celui qui les partage et l'acteur qui lui est confié.
-- - Pour chaque étape, il donne son avis : « validée » ou « à revoir »
--   (avec un commentaire, obligatoire pour « à revoir »). Pas de messagerie.
-- - Un avis n'est lisible que par son auteur et le propriétaire du process.
--   Retirer un membre retire ses avis ; supprimer le process aussi.

-- 1. Les process partagés avec moi ------------------------------------------------
-- Le process (lisible par le membre, voir « Lire les process partagés avec
-- moi ») et le nom du propriétaire, dont le profil n'est pas lisible directement.

create or replace function public.shared_with_me()
returns table (
  process_id uuid,
  name text,
  source text,
  content jsonb,
  updated_at timestamptz,
  actor text,
  owner_first_name text,
  owner_last_name text,
  owner_username text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.source, p.content, p.updated_at, m.actor, pr.first_name, pr.last_name, pr.username
  from public.process_members m
  join public.processes p on p.id = m.process_id
  left join public.profiles pr on pr.id = p.owner_id
  where m.member_id = (select auth.uid())
  order by m.created_at desc;
$$;

revoke all on function public.shared_with_me() from public, anon;
grant execute on function public.shared_with_me() to authenticated;

-- 2. Les avis par étape ------------------------------------------------------------

create table if not exists public.step_reviews (
  process_id uuid not null,
  member_id uuid not null default auth.uid(),
  -- Identifiant de l'étape dans le schéma (content.steps[].id).
  step_id text not null check (char_length(step_id) between 1 and 200),
  status text not null check (status in ('valide', 'a_revoir')),
  comment text check (comment is null or char_length(comment) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (process_id, member_id, step_id),
  -- Seul un membre du process peut donner un avis ; le retirer retire ses avis.
  foreign key (process_id, member_id) references public.process_members (process_id, member_id) on delete cascade,
  -- « À revoir » sans dire quoi n'aide personne.
  check (status = 'valide' or char_length(btrim(coalesce(comment, ''))) >= 1)
);

comment on table public.step_reviews is 'Avis d''un membre sur une étape d''un process partagé : validée ou à revoir, avec un commentaire.';

drop trigger if exists step_reviews_set_updated_at on public.step_reviews;
create trigger step_reviews_set_updated_at
  before update on public.step_reviews
  for each row execute function public.set_updated_at();

-- 3. Sécurité des avis ----------------------------------------------------------------

alter table public.step_reviews enable row level security;

revoke all on public.step_reviews from anon;
grant select, insert, update, delete on public.step_reviews to authenticated;

drop policy if exists "Lire ses avis, ou ceux sur ses process" on public.step_reviews;
create policy "Lire ses avis, ou ceux sur ses process" on public.step_reviews
  for select to authenticated
  using (member_id = (select auth.uid()) or public.is_process_owner(process_id));

drop policy if exists "Donner son avis" on public.step_reviews;
create policy "Donner son avis" on public.step_reviews
  for insert to authenticated
  with check (member_id = (select auth.uid()) and public.is_process_member(process_id));

drop policy if exists "Changer son avis" on public.step_reviews;
create policy "Changer son avis" on public.step_reviews
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()) and public.is_process_member(process_id));

drop policy if exists "Retirer son avis" on public.step_reviews;
create policy "Retirer son avis" on public.step_reviews
  for delete to authenticated
  using (member_id = (select auth.uid()));
