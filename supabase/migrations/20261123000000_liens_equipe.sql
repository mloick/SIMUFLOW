-- Tableau de bord d'un projet : l'équipe voit aussi les avis donnés par les
-- liens d'acteur (personnes sans compte), sans jamais voir le jeton du lien.
--
-- Les tables actor_links et link_reviews restent lisibles par le seul
-- propriétaire du process : le jeton est le secret qui permet de relire et de
-- donner un avis à la place de l'acteur. On ajoute une fonction qui renvoie
-- les liens et leurs avis SANS le jeton, au propriétaire et à l'équipe du
-- projet où le process est rangé.
--
-- À coller dans l'éditeur SQL de Supabase, après 20261122000000_tableau_de_bord.sql.
-- Relancer le script ne casse rien.

create or replace function public.link_activity_of(p_process uuid)
returns table (
  link_id uuid,
  actor text,
  step_id text,
  status text,
  comment text,
  reviewer_name text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Un lien sans avis donne une ligne avec step_id vide : l'acteur compte
  -- quand même, comme « pas commencé ».
  select l.id, l.actor, r.step_id, r.status, r.comment, r.reviewer_name, r.updated_at
  from public.actor_links l
  left join public.link_reviews r on r.link_id = l.id
  where l.process_id = p_process
    and (public.is_process_owner(p_process) or public.in_my_project(p_process))
  order by l.created_at, r.step_id;
$$;

revoke all on function public.link_activity_of(uuid) from public, anon;
grant execute on function public.link_activity_of(uuid) to authenticated;
