-- SimuFlow, étape 7d : un compte peut se supprimer lui-même.
--
-- À coller dans Supabase : SQL Editor > New query > Run. Peut être relancé.
--
-- L'app ne peut pas effacer un compte directement : seul l'administrateur
-- touche à auth.users, et sa clé secrète ne doit jamais être dans l'app.
-- Cette fonction le fait à sa place, mais uniquement pour le compte connecté
-- qui l'appelle (auth.uid()). Ses process partent avec lui (on delete cascade).

create or replace function public.delete_my_account()
returns void
language plpgsql
-- Exécutée avec les droits de son créateur (l'administrateur), pas ceux de
-- l'appelant : c'est ce qui lui permet d'effacer dans auth.users.
security definer
-- Chemin de recherche vide : chaque nom est écrit en entier (auth.users),
-- personne ne peut glisser une fausse table du même nom.
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Connexion requise pour supprimer son compte' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

comment on function public.delete_my_account() is 'Supprime le compte connecté et toutes ses données.';

-- Par défaut, tout le monde peut appeler une fonction : on ferme, puis on
-- n'ouvre qu'aux comptes connectés.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
