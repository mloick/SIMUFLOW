-- SimuFlow : les liens de consultation, pour montrer un formulaire, un workflow,
-- ou un formulaire et son workflow à quelqu'un qui n'a pas de compte.
--
-- Passe sur la base par la CLI Supabase (npm run db:envoyer). Peut être relancé.
--
-- Principe :
-- - Le lien garde une COPIE de ce qu'on montre, prise au moment où on le crée
--   (content). Modifier le formulaire ou le process ensuite ne change pas le
--   lien : on en crée un nouveau.
-- - Trois sortes (kind) : 'form' (un formulaire seul), 'workflow' (un workflow
--   seul), 'form_workflow' (un formulaire et le workflow qui le suit).
-- - La page du lien est en lecture seule : la personne peut remplir le
--   formulaire pour l'essayer, mais rien de ce qu'elle tape n'est envoyé.
--   Il n'y a donc aucune fonction d'écriture pour anon.
-- - Sans compte, on ne lit un lien que par son jeton (view_link_open). La table
--   elle-même n'est lisible que par son propriétaire.
-- - Un lien vaut 30 jours ; son propriétaire peut le prolonger de 30 jours à
--   partir d'aujourd'hui (view_link_extend) ou le retirer. Au plus 100 liens
--   par compte. Les liens partent avec le compte.

-- 1. La table ------------------------------------------------------------------------

create table if not exists public.view_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('form', 'workflow', 'form_workflow')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- { "form": {…} } , { "workflow": {…} } ou { "form": {…}, "workflow": {…} }, au format de l'app.
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 5000000),
  -- Le mot de celui qui envoie le lien, affiché à côté du guide.
  note text check (note is null or char_length(note) <= 1000),
  -- 64 caractères hexadécimaux tirés au hasard (deux UUID v4) : impossible à deviner.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  -- La sorte annoncée correspond à ce que contient la copie.
  constraint view_links_kind_content check (coalesce(
    case kind
      when 'form' then jsonb_typeof(content -> 'form') = 'object' and not content ? 'workflow'
      when 'workflow' then jsonb_typeof(content -> 'workflow') = 'object' and not content ? 'form'
      else jsonb_typeof(content -> 'form') = 'object' and jsonb_typeof(content -> 'workflow') = 'object'
    end, false)
  )
);

comment on table public.view_links is 'Lien de consultation sans compte : copie d''un formulaire et / ou d''un workflow, en lecture seule.';

create index if not exists view_links_owner on public.view_links (owner_id, created_at);

alter table public.view_links enable row level security;

revoke all on public.view_links from anon;
-- Pas d'update : la date de fin passe par view_link_extend, le reste ne change pas.
revoke update on public.view_links from authenticated;
grant select, insert, delete on public.view_links to authenticated;

drop policy if exists "Voir ses liens de consultation" on public.view_links;
create policy "Voir ses liens de consultation" on public.view_links
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Créer ses liens de consultation" on public.view_links;
create policy "Créer ses liens de consultation" on public.view_links
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Retirer ses liens de consultation" on public.view_links;
create policy "Retirer ses liens de consultation" on public.view_links
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 2. Au plus 100 liens par compte, et une date de fin à 30 jours -----------------------
-- Code d'erreur : SF429 (trop de liens). La date de fin et le jeton ne se
-- choisissent pas : ils sont toujours ceux de la base.

create or replace function public.view_links_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.view_links l where l.owner_id = new.owner_id) >= 100 then
    raise exception 'Vous avez déjà 100 liens de consultation : retirez-en avant d''en créer un autre.'
      using errcode = 'SF429';
  end if;
  new.token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  new.created_at := now();
  new.expires_at := now() + interval '30 days';
  return new;
end;
$$;

revoke all on function public.view_links_before_insert() from public, anon, authenticated;

drop trigger if exists view_links_before_insert on public.view_links;
create trigger view_links_before_insert
  before insert on public.view_links
  for each row execute function public.view_links_before_insert();

-- 3. Ouvrir un lien par son jeton, sans compte -----------------------------------------
-- Codes d'erreur lus par l'app : P0002 (lien inconnu ou retiré), SF410 (lien expiré).

create or replace function public.view_link_open(p_token text)
returns table (
  kind text,
  title text,
  content jsonb,
  note text,
  expires_at timestamptz,
  owner_first_name text,
  owner_last_name text,
  owner_username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.view_links;
begin
  select * into v_link from public.view_links l where l.token = btrim(coalesce(p_token, ''));
  if v_link.id is null then
    raise exception 'Ce lien n''existe pas ou a été retiré.' using errcode = 'P0002';
  end if;
  if v_link.expires_at <= now() then
    raise exception 'Ce lien a expiré.' using errcode = 'SF410';
  end if;
  return query
    select v_link.kind, v_link.title, v_link.content, v_link.note, v_link.expires_at,
      pr.first_name, pr.last_name, pr.username
    from (select 1) as one
    left join public.profiles pr on pr.id = v_link.owner_id;
end;
$$;

revoke all on function public.view_link_open(text) from public;
grant execute on function public.view_link_open(text) to anon, authenticated;

-- 4. Prolonger un lien (son propriétaire seulement) ------------------------------------
-- Code d'erreur : 42501 (pas son lien, ou lien inconnu).

create or replace function public.view_link_extend(p_link uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  update public.view_links set expires_at = now() + interval '30 days'
  where id = p_link and owner_id = (select auth.uid())
  returning view_links.expires_at into v_until;
  if v_until is null then
    raise exception 'Seul le propriétaire du lien peut le prolonger.' using errcode = '42501';
  end if;
  return v_until;
end;
$$;

revoke all on function public.view_link_extend(uuid) from public, anon;
grant execute on function public.view_link_extend(uuid) to authenticated;
