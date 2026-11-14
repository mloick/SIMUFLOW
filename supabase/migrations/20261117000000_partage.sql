-- SimuFlow : partager un process avec des membres (d'autres comptes).
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
-- Demande d'abord les tables des process et des profils.
--
-- Principe :
-- - Le propriétaire d'un process invite des membres, autant qu'il faut (100 au
--   plus), par leur identifiant (« julie.martin ») ou leur adresse e-mail, et
--   relie chacun, s'il le veut, à un acteur du schéma (« Service achats »).
-- - Un membre peut lire le process partagé, jamais le modifier ni le supprimer.
-- - L'invitation passe par une fonction (invite_member) : l'app ne lit jamais
--   la liste des comptes ni leurs adresses. La fonction ne répond qu'au
--   propriétaire du process et ne renvoie que le nom et l'identifiant.
-- - La liste des membres (members_of) n'est lisible que par le propriétaire
--   et les membres du process.

-- 1. La table des membres --------------------------------------------------------

create table if not exists public.process_members (
  process_id uuid not null references public.processes (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  -- Acteur du schéma dont le membre s'occupe (facultatif).
  actor text check (actor is null or char_length(btrim(actor)) between 1 and 200),
  invited_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (process_id, member_id)
);

comment on table public.process_members is 'Membres invités sur un process SimuFlow, avec l''acteur du schéma dont chacun s''occupe.';

-- Les process partagés avec un compte se lisent ensemble.
create index if not exists process_members_member_id_idx on public.process_members (member_id);

-- 2. Qui est propriétaire, qui est membre ----------------------------------------
-- Fonctions « security definer » : elles lisent les tables sans repasser par
-- leurs propres règles (sinon les règles de processes et de process_members
-- s'appelleraient l'une l'autre sans fin).

create or replace function public.is_process_owner(p_process uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.processes where id = p_process and owner_id = (select auth.uid())
  );
$$;

create or replace function public.is_process_member(p_process uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.process_members where process_id = p_process and member_id = (select auth.uid())
  );
$$;

revoke all on function public.is_process_owner(uuid) from public, anon;
revoke all on function public.is_process_member(uuid) from public, anon;
grant execute on function public.is_process_owner(uuid) to authenticated;
grant execute on function public.is_process_member(uuid) to authenticated;

-- 3. Sécurité de la table des membres ----------------------------------------------

alter table public.process_members enable row level security;

revoke all on public.process_members from anon;
-- Pas d'insert direct : on invite par invite_member, qui retrouve le compte.
grant select, update (actor), delete on public.process_members to authenticated;

drop policy if exists "Voir les membres de ses process" on public.process_members;
create policy "Voir les membres de ses process" on public.process_members
  for select to authenticated
  using (public.is_process_owner(process_id) or member_id = (select auth.uid()));

drop policy if exists "Changer l'acteur d'un membre" on public.process_members;
create policy "Changer l'acteur d'un membre" on public.process_members
  for update to authenticated
  using (public.is_process_owner(process_id))
  with check (public.is_process_owner(process_id));

drop policy if exists "Retirer un membre ou se retirer" on public.process_members;
create policy "Retirer un membre ou se retirer" on public.process_members
  for delete to authenticated
  using (public.is_process_owner(process_id) or member_id = (select auth.uid()));

-- 4. Un membre lit le process partagé ----------------------------------------------
-- S'ajoute à « Lire ses process » : les règles de lecture se cumulent. Rien ne
-- change pour la modification et la suppression, réservées au propriétaire.

drop policy if exists "Lire les process partagés avec moi" on public.processes;
create policy "Lire les process partagés avec moi" on public.processes
  for select to authenticated
  using (public.is_process_member(id));

-- 5. Inviter un membre ----------------------------------------------------------------
-- Codes d'erreur lus par l'app : 42501 (pas le propriétaire), P0002 (compte
-- introuvable), 22023 (s'inviter soi-même), 54000 (plus de 100 membres).

create or replace function public.invite_member(p_process uuid, p_who text, p_actor text default null)
returns table (member_id uuid, first_name text, last_name text, username text, actor text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- « @julie.martin » ou « julie.martin » : un identifiant ; « julie@exemple.fr » : une adresse.
  v_who text := ltrim(lower(btrim(coalesce(p_who, ''))), '@');
  v_member uuid;
  v_actor text := nullif(btrim(coalesce(p_actor, '')), '');
begin
  if not public.is_process_owner(p_process) then
    raise exception 'Seul le propriétaire du process peut inviter.' using errcode = '42501';
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
    raise exception 'Vous êtes déjà le propriétaire de ce process.' using errcode = '22023';
  end if;
  if (select count(*) from public.process_members m where m.process_id = p_process) >= 100
     and not exists (select 1 from public.process_members m where m.process_id = p_process and m.member_id = v_member) then
    raise exception 'Un process compte au plus 100 membres.' using errcode = '54000';
  end if;

  insert into public.process_members as m (process_id, member_id, actor)
  values (p_process, v_member, v_actor)
  on conflict (process_id, member_id) do update set actor = excluded.actor;

  return query
    select v_member, pr.first_name, pr.last_name, pr.username, v_actor
    from (select 1) one
    left join public.profiles pr on pr.id = v_member;
end;
$$;

revoke all on function public.invite_member(uuid, text, text) from public, anon;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

-- 6. La liste des membres d'un process -------------------------------------------------
-- Nom et identifiant de chaque membre (le profil d'un autre compte n'est pas
-- lisible directement), pour le propriétaire et les membres du process.

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
    and (public.is_process_owner(p_process) or public.is_process_member(p_process))
  order by m.created_at;
$$;

revoke all on function public.members_of(uuid) from public, anon;
grant execute on function public.members_of(uuid) to authenticated;
