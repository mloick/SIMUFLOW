-- SimuFlow, étape L3b : les règles de lecture apprises, gardées sur le compte.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
--
-- Une ligne par compte : la liste de ses règles, au format de l'app
-- ([{ "type": "actor", "from": "…", "to": "…" }, { "type": "role", "shape": "…", "role": "…" }]).
-- Mêmes principes que pour les process : chaque compte ne lit et n'écrit que sa
-- ligne (RLS), rien pour anon, et la ligne part avec le compte.

-- 1. La table ------------------------------------------------------------------

create table if not exists public.reading_rules (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) <= 500),
  updated_at timestamptz not null default now()
);

comment on table public.reading_rules is 'Règles de lecture apprises par SimuFlow, une ligne par compte, visible par son seul propriétaire.';

-- 2. Date de modification (fonction créée avec la table des process) ------------

drop trigger if exists reading_rules_set_updated_at on public.reading_rules;
create trigger reading_rules_set_updated_at
  before update on public.reading_rules
  for each row execute function public.set_updated_at();

-- 3. Sécurité --------------------------------------------------------------------

alter table public.reading_rules enable row level security;

revoke all on public.reading_rules from anon;
grant select, insert, update, delete on public.reading_rules to authenticated;

drop policy if exists "Lire ses règles" on public.reading_rules;
create policy "Lire ses règles" on public.reading_rules
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Créer ses règles" on public.reading_rules;
create policy "Créer ses règles" on public.reading_rules
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Modifier ses règles" on public.reading_rules;
create policy "Modifier ses règles" on public.reading_rules
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Supprimer ses règles" on public.reading_rules;
create policy "Supprimer ses règles" on public.reading_rules
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
