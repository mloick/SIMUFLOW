-- SimuFlow : l'équipe d'un projet et le rôle de chef de projet.
--
-- À coller dans Supabase : SQL Editor > New query > Run, après
-- 20261120000000_projets.sql. Le script peut être relancé sans risque.
--
-- Principe (étape 2) : le chef d'un projet (projects.chef_id) invite des
-- collaborateurs (table project_members). Toute l'équipe voit le projet et lit
-- tous ses process ; chacun peut y ranger ses propres process. Le chef peut
-- passer son rôle à un collaborateur : il devient alors collaborateur. Le rôle
-- dépend du projet, pas du compte. Les acteurs restent définis process par
-- process (process_members), comme avant.

-- 1. La table de l'équipe ----------------------------------------------------------

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, member_id)
);

comment on table public.project_members is 'Collaborateurs d''un projet SimuFlow (le chef est dans projects.chef_id).';

create index if not exists project_members_member_id_idx on public.project_members (member_id);

-- 2. Qui est chef, qui est dans l'équipe -------------------------------------------
-- « security definer » : ces fonctions lisent les tables sans repasser par leurs
-- règles (sinon les règles de projects et de project_members s'appelleraient
-- l'une l'autre sans fin).

create or replace function public.is_project_chef(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects where id = p_project and chef_id = (select auth.uid())
  );
$$;

-- Le chef ou un collaborateur.
create or replace function public.is_in_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_project_chef(p_project) or exists (
    select 1 from public.project_members where project_id = p_project and member_id = (select auth.uid())
  );
$$;

revoke all on function public.is_project_chef(uuid) from public, anon;
revoke all on function public.is_in_project(uuid) from public, anon;
grant execute on function public.is_project_chef(uuid) to authenticated;
grant execute on function public.is_in_project(uuid) to authenticated;

-- Toute l'équipe peut ranger ses propres process dans le projet (étape 1 : le chef seul).
create or replace function public.can_use_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_in_project(p_project);
$$;

-- 3. Sécurité de l'équipe ----------------------------------------------------------

alter table public.project_members enable row level security;

revoke all on public.project_members from anon;
-- Pas d'insert direct : on invite par invite_to_project, qui retrouve le compte.
grant select, delete on public.project_members to authenticated;

drop policy if exists "Voir l'équipe de ses projets" on public.project_members;
create policy "Voir l'équipe de ses projets" on public.project_members
  for select to authenticated
  using (public.is_in_project(project_id));

drop policy if exists "Retirer un collaborateur ou quitter le projet" on public.project_members;
create policy "Retirer un collaborateur ou quitter le projet" on public.project_members
  for delete to authenticated
  using (public.is_project_chef(project_id) or member_id = (select auth.uid()));

-- Un collaborateur qui quitte le projet (ou en est retiré) en sort ses process.
-- Pas quand il en devient le chef (transfer_chef le retire de l'équipe après
-- l'avoir nommé chef).
create or replace function public.release_member_processes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects where id = old.project_id and chef_id = old.member_id) then
    update public.processes set project_id = null
    where project_id = old.project_id and owner_id = old.member_id;
  end if;
  return old;
end;
$$;

revoke all on function public.release_member_processes() from public, anon, authenticated;

drop trigger if exists project_members_release_processes on public.project_members;
create trigger project_members_release_processes
  after delete on public.project_members
  for each row execute function public.release_member_processes();

-- 4. L'équipe lit le projet et ses process -----------------------------------------
-- S'ajoute aux règles de l'étape 1 : les règles de lecture se cumulent.
-- Renommer et supprimer le projet restent réservés au chef.

drop policy if exists "Lire les projets de mon équipe" on public.projects;
create policy "Lire les projets de mon équipe" on public.projects
  for select to authenticated
  using (public.is_in_project(id));

drop policy if exists "Lire les process de mes projets" on public.processes;
create policy "Lire les process de mes projets" on public.processes
  for select to authenticated
  using (project_id is not null and public.is_in_project(project_id));

-- 5. Inviter dans l'équipe ----------------------------------------------------------
-- Codes d'erreur lus par l'app : 42501 (pas le chef), P0002 (compte introuvable),
-- 22023 (s'inviter soi-même), 54000 (plus de 100 collaborateurs).

create or replace function public.invite_to_project(p_project uuid, p_who text)
returns table (member_id uuid, first_name text, last_name text, username text, role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_who text := ltrim(lower(btrim(coalesce(p_who, ''))), '@');
  v_member uuid;
begin
  if not public.is_project_chef(p_project) then
    raise exception 'Seul le chef de projet peut inviter.' using errcode = '42501';
  end if;
  if v_who like '%@%' then
    select u.id into v_member from auth.users u where lower(u.email) = v_who limit 1;
  else
    select pr.id into v_member from public.profiles pr where pr.username = v_who;
  end if;
  if v_member is null then
    raise exception 'Aucun compte SimuFlow avec cet identifiant ou cette adresse.' using errcode = 'P0002';
  end if;
  if v_member = (select auth.uid()) then
    raise exception 'Vous êtes déjà le chef de ce projet.' using errcode = '22023';
  end if;
  if (select count(*) from public.project_members m where m.project_id = p_project) >= 100
     and not exists (select 1 from public.project_members m where m.project_id = p_project and m.member_id = v_member) then
    raise exception 'Un projet compte au plus 100 collaborateurs.' using errcode = '54000';
  end if;

  insert into public.project_members (project_id, member_id)
  values (p_project, v_member)
  on conflict (project_id, member_id) do nothing;

  return query
    select v_member, pr.first_name, pr.last_name, pr.username, 'collaborateur'::text
    from (select 1) one
    left join public.profiles pr on pr.id = v_member;
end;
$$;

revoke all on function public.invite_to_project(uuid, text) from public, anon;
grant execute on function public.invite_to_project(uuid, text) to authenticated;

-- 6. L'équipe d'un projet : le chef d'abord, puis les collaborateurs ---------------

create or replace function public.team_of(p_project uuid)
returns table (member_id uuid, first_name text, last_name text, username text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.member_id, pr.first_name, pr.last_name, pr.username, t.role
  from (
    select p.chef_id as member_id, 'chef'::text as role, p.created_at as since, 0 as rank
    from public.projects p where p.id = p_project
    union all
    select m.member_id, 'collaborateur'::text, m.created_at, 1
    from public.project_members m where m.project_id = p_project
  ) t
  left join public.profiles pr on pr.id = t.member_id
  where public.is_in_project(p_project)
  order by t.rank, t.since;
$$;

revoke all on function public.team_of(uuid) from public, anon;
grant execute on function public.team_of(uuid) to authenticated;

-- 7. Les projets où je suis collaborateur, avec le nom de leur chef ----------------

create or replace function public.team_projects()
returns table (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  chef_first_name text,
  chef_last_name text,
  chef_username text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.description, p.created_at, pr.first_name, pr.last_name, pr.username
  from public.project_members m
  join public.projects p on p.id = m.project_id
  left join public.profiles pr on pr.id = p.chef_id
  where m.member_id = (select auth.uid())
  order by m.created_at desc;
$$;

revoke all on function public.team_projects() from public, anon;
grant execute on function public.team_projects() to authenticated;

-- 8. Nommer un autre chef de projet -------------------------------------------------
-- Seul le chef ; le nouveau chef doit déjà être dans l'équipe (P0002 sinon).
-- L'ancien chef reste dans le projet, comme collaborateur.

create or replace function public.transfer_chef(p_project uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.is_project_chef(p_project) then
    raise exception 'Seul le chef de projet peut nommer un autre chef.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.project_members where project_id = p_project and member_id = p_member) then
    raise exception 'Cette personne n''est pas dans l''équipe du projet.' using errcode = 'P0002';
  end if;
  update public.projects set chef_id = p_member where id = p_project;
  delete from public.project_members where project_id = p_project and member_id = p_member;
  insert into public.project_members (project_id, member_id, added_by)
  values (p_project, me, p_member)
  on conflict (project_id, member_id) do nothing;
end;
$$;

revoke all on function public.transfer_chef(uuid, uuid) from public, anon;
grant execute on function public.transfer_chef(uuid, uuid) to authenticated;

-- 9. Les process partagés avec moi, y compris ceux de mes projets ------------------
-- Remplace la fonction de 20261118000000_avis.sql : en plus des process où je
-- suis membre (avec mon acteur), ceux rangés dans un projet de mon équipe dont
-- je ne suis pas le propriétaire. `is_member` dit si je peux donner mon avis
-- (seulement les membres du process) ; `project_id` dit dans quel projet il est.

drop function if exists public.shared_with_me();
create function public.shared_with_me()
returns table (
  process_id uuid,
  name text,
  source text,
  content jsonb,
  updated_at timestamptz,
  actor text,
  owner_first_name text,
  owner_last_name text,
  owner_username text,
  project_id uuid,
  is_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.source, p.content, p.updated_at, m.actor, pr.first_name, pr.last_name, pr.username,
         p.project_id, m.member_id is not null
  from public.processes p
  left join public.process_members m on m.process_id = p.id and m.member_id = (select auth.uid())
  left join public.profiles pr on pr.id = p.owner_id
  where p.owner_id <> (select auth.uid())
    and (m.member_id is not null or (p.project_id is not null and public.is_in_project(p.project_id)))
  order by coalesce(m.created_at, p.updated_at) desc;
$$;

revoke all on function public.shared_with_me() from public, anon;
grant execute on function public.shared_with_me() to authenticated;

-- 10. Un chef qui supprime son compte -----------------------------------------------
-- Ses projets passent au plus ancien collaborateur ; un projet sans
-- collaborateur est supprimé avec le compte (ses process restent à leurs
-- propriétaires, hors projet).

create or replace function public.hand_over_projects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next uuid;
begin
  for r in select id from public.projects where chef_id = old.id loop
    select m.member_id into v_next
    from public.project_members m
    where m.project_id = r.id and m.member_id <> old.id
    order by m.created_at
    limit 1;
    if v_next is not null then
      update public.projects set chef_id = v_next where id = r.id;
      delete from public.project_members where project_id = r.id and member_id = v_next;
    end if;
  end loop;
  return old;
end;
$$;

revoke all on function public.hand_over_projects() from public, anon, authenticated;

drop trigger if exists users_hand_over_projects on auth.users;
create trigger users_hand_over_projects
  before delete on auth.users
  for each row execute function public.hand_over_projects();
