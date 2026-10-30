-- SimuFlow, étape 7b : la table des process et ses règles de sécurité.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Le script peut être
-- relancé sans risque : il ne recrée que ce qui manque.
--
-- Principe : chaque process appartient à un compte (owner_id). Les règles de
-- Row Level Security (RLS) font que chaque compte ne voit, ne crée, ne modifie
-- et ne supprime que ses propres process. Sans connexion (rôle anon), rien.

-- 1. La table ------------------------------------------------------------------

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  -- Propriétaire : le compte connecté, rempli automatiquement à la création.
  -- Si le compte est supprimé, ses process le sont aussi (on delete cascade).
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  source text check (source in ('drawio', 'scan', 'json')),
  -- Étapes et liens du process, au format de l'app : { "steps": [...], "links": [...] }.
  content jsonb not null check (
    jsonb_typeof(content -> 'steps') = 'array' and jsonb_typeof(content -> 'links') = 'array'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.processes is 'Process de SimuFlow, un par ligne, visibles par leur seul propriétaire.';

-- Les process d'un compte se lisent souvent ensemble : index sur le propriétaire.
create index if not exists processes_owner_id_idx on public.processes (owner_id);

-- 2. Date de modification tenue à jour par la base ------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processes_set_updated_at on public.processes;
create trigger processes_set_updated_at
  before update on public.processes
  for each row execute function public.set_updated_at();

-- 3. Sécurité --------------------------------------------------------------------

-- RLS : sans règle qui l'autorise, aucune ligne n'est visible ni modifiable.
alter table public.processes enable row level security;

-- Le projet n'expose pas les nouvelles tables automatiquement : on ouvre
-- l'accès aux seuls comptes connectés (authenticated), jamais à anon.
revoke all on public.processes from anon;
grant select, insert, update, delete on public.processes to authenticated;

-- Une règle par action. (select auth.uid()) est évalué une fois par requête,
-- et non pour chaque ligne : c'est la forme recommandée par Supabase.
drop policy if exists "Lire ses process" on public.processes;
create policy "Lire ses process" on public.processes
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Créer ses process" on public.processes;
create policy "Créer ses process" on public.processes
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Modifier ses process" on public.processes;
create policy "Modifier ses process" on public.processes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Supprimer ses process" on public.processes;
create policy "Supprimer ses process" on public.processes
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
