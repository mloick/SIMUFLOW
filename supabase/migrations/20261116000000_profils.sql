-- SimuFlow : le profil de chaque compte (prénom, nom, identifiant, rôle).
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
--
-- Première brique du partage d'un process : pour inviter quelqu'un, il faudra
-- le retrouver par son identifiant (« julie.martin »). Le rôle (chef de projet
-- ou collaborateur) est une simple mention, déclarée par la personne.
--
-- Pour l'instant, chaque compte ne lit et n'écrit que son propre profil (RLS),
-- rien pour anon, et le profil part avec le compte. La recherche d'un autre
-- compte par identifiant viendra avec le partage, par une fonction dédiée qui
-- ne renverra que le strict nécessaire.

-- 1. La table ------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
  -- Minuscules, chiffres, point, tiret, tiret bas ; 3 à 30 caractères, commence par une lettre ou un chiffre.
  username text not null check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  role text check (role in ('chef_de_projet', 'collaborateur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil de chaque compte SimuFlow (nom, identifiant unique, rôle déclaré).';

-- Un identifiant n'appartient qu'à un compte.
create unique index if not exists profiles_username_key on public.profiles (username);

-- 2. Date de modification (fonction créée avec la table des process) ------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. Sécurité --------------------------------------------------------------------

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists "Lire son profil" on public.profiles;
create policy "Lire son profil" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Créer son profil" on public.profiles;
create policy "Créer son profil" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Modifier son profil" on public.profiles;
create policy "Modifier son profil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Supprimer son profil" on public.profiles;
create policy "Supprimer son profil" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);
