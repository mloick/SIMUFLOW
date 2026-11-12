-- SimuFlow : les formulaires gardés (« Mes formulaires »), gardés sur le compte.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
--
-- Une ligne par compte : la liste de ses formulaires, au format de l'app
-- ([{ "id": "…", "form": { "questions": […] }, "source": "…", "workflow": … }]).
-- Mêmes principes que pour les règles de lecture : chaque compte ne lit et
-- n'écrit que sa ligne (RLS), rien pour anon, et la ligne part avec le compte.

-- 1. La table ------------------------------------------------------------------

create table if not exists public.saved_forms (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  forms jsonb not null default '[]'::jsonb check (
    jsonb_typeof(forms) = 'array'
    and jsonb_array_length(forms) <= 200
    and pg_column_size(forms) <= 5000000
  ),
  updated_at timestamptz not null default now()
);

comment on table public.saved_forms is 'Formulaires gardés dans SimuFlow, une ligne par compte, visible par son seul propriétaire.';

-- 2. Date de modification (fonction créée avec la table des process) ------------

drop trigger if exists saved_forms_set_updated_at on public.saved_forms;
create trigger saved_forms_set_updated_at
  before update on public.saved_forms
  for each row execute function public.set_updated_at();

-- 3. Sécurité --------------------------------------------------------------------

alter table public.saved_forms enable row level security;

revoke all on public.saved_forms from anon;
grant select, insert, update, delete on public.saved_forms to authenticated;

drop policy if exists "Lire ses formulaires" on public.saved_forms;
create policy "Lire ses formulaires" on public.saved_forms
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Créer ses formulaires" on public.saved_forms;
create policy "Créer ses formulaires" on public.saved_forms
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Modifier ses formulaires" on public.saved_forms;
create policy "Modifier ses formulaires" on public.saved_forms
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Supprimer ses formulaires" on public.saved_forms;
create policy "Supprimer ses formulaires" on public.saved_forms
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
