-- Tableau de bord d'un projet : toute l'équipe voit où en est la relecture de
-- chaque process du projet.
--
-- Avant, seuls le propriétaire d'un process et le membre lui-même lisaient les
-- membres (process_members) et les avis (step_reviews). Le chef ne voyait donc
-- rien sur les process de ses collaborateurs. On ajoute une seule règle :
-- l'équipe d'un projet (chef et collaborateurs) LIT les membres et les avis des
-- process rangés dans ce projet. Personne ne gagne le droit d'écrire.
--
-- À coller dans l'éditeur SQL de Supabase, après 20261121000000_equipe_projet.sql.
-- Relancer le script ne casse rien.

-- 1. Le process est-il dans un projet dont je fais partie ? ---------------------------
-- « security definer » : la fonction lit processes sans repasser par ses règles.

create or replace function public.in_my_project(p_process uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.processes p
    where p.id = p_process and p.project_id is not null and public.is_in_project(p.project_id)
  );
$$;

revoke all on function public.in_my_project(uuid) from public, anon;
grant execute on function public.in_my_project(uuid) to authenticated;

-- 2. Lire les membres et les avis ---------------------------------------------------

drop policy if exists "Voir les membres de ses process" on public.process_members;
create policy "Voir les membres de ses process" on public.process_members
  for select to authenticated
  using (
    public.is_process_owner(process_id)
    or member_id = (select auth.uid())
    or public.in_my_project(process_id)
  );

drop policy if exists "Lire ses avis, ou ceux sur ses process" on public.step_reviews;
create policy "Lire ses avis, ou ceux sur ses process" on public.step_reviews
  for select to authenticated
  using (
    member_id = (select auth.uid())
    or public.is_process_owner(process_id)
    or public.in_my_project(process_id)
  );

-- 3. Le nom des membres -------------------------------------------------------------
-- Même liste qu'avant, aussi pour l'équipe du projet.

create or replace function public.members_of(p_process uuid)
returns table (member_id uuid, first_name text, last_name text, username text, actor text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.member_id, pr.first_name, pr.last_name, pr.username, m.actor
  from public.process_members m
  left join public.profiles pr on pr.id = m.member_id
  where m.process_id = p_process
    and (
      public.is_process_owner(p_process)
      or public.is_process_member(p_process)
      or public.in_my_project(p_process)
    )
  order by m.created_at;
$$;

revoke all on function public.members_of(uuid) from public, anon;
grant execute on function public.members_of(uuid) to authenticated;
