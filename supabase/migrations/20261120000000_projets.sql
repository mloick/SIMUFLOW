-- SimuFlow : les projets, qui regroupent plusieurs process.
--
-- À coller dans Supabase : SQL Editor > New query > Run, après les scripts
-- précédents. Le script peut être relancé sans risque.
--
-- Principe (étape 1) : un projet a un nom, une description facultative et un
-- chef de projet (chef_id), qui est le compte qui l'a créé. Chaque process peut
-- être rangé dans un projet (processes.project_id, facultatif). Pour l'instant,
-- seul le chef voit son projet ; l'équipe du projet viendra à l'étape suivante.
--
-- L'identifiant d'un projet est choisi par le téléphone (un UUID) : le projet
-- garde le même identifiant hors connexion et sur le serveur.

-- 1. La table des projets ---------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  -- Chef de projet : le compte qui l'a créé.
  chef_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is 'Projets SimuFlow : un nom, un chef de projet, et les process qui y sont rangés.';

create index if not exists projects_chef_id_idx on public.projects (chef_id);

-- Date de modification tenue à jour (fonction créée avec la table des process).
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- 2. Sécurité des projets ---------------------------------------------------------

alter table public.projects enable row level security;

revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;

drop policy if exists "Lire ses projets" on public.projects;
create policy "Lire ses projets" on public.projects
  for select to authenticated
  using ((select auth.uid()) = chef_id);

drop policy if exists "Créer ses projets" on public.projects;
create policy "Créer ses projets" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = chef_id);

drop policy if exists "Modifier ses projets" on public.projects;
create policy "Modifier ses projets" on public.projects
  for update to authenticated
  using ((select auth.uid()) = chef_id)
  with check ((select auth.uid()) = chef_id);

drop policy if exists "Supprimer ses projets" on public.projects;
create policy "Supprimer ses projets" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = chef_id);

-- 3. Ranger un process dans un projet ---------------------------------------------
-- Supprimer un projet ne supprime pas ses process : ils sortent du projet.

alter table public.processes
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists processes_project_id_idx on public.processes (project_id);

-- On ne range un process que dans un projet dont on est le chef (la clé
-- étrangère seule ne le vérifie pas : elle ignore les règles de sécurité).
create or replace function public.can_use_project(p_project uuid)
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

revoke all on function public.can_use_project(uuid) from public, anon;
grant execute on function public.can_use_project(uuid) to authenticated;

create or replace function public.check_process_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is not null
     and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id)
     and not public.can_use_project(new.project_id) then
    raise exception 'Ce projet n''existe pas ou ne vous appartient pas.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists processes_check_project on public.processes;
create trigger processes_check_project
  before insert or update of project_id on public.processes
  for each row execute function public.check_process_project();
