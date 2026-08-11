-- Expose les voyageurs (nom + avatar) d'un voyage à un visiteur non authentifié via le lien de
-- partage public du journal — même principe que get_public_journal/get_public_journal_meta
-- (SECURITY DEFINER, ne renvoie rien pour un voyage sans partage actif).
create or replace function public.get_public_journal_travelers(p_share_token uuid)
returns table (
  name text,
  avatar_emoji text,
  avatar_config jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select p.name, p.avatar_emoji, p.avatar_config
  from public.voyages v
  join public.project_people pp on pp.project_id = v.project_id
  join public.people p on p.id = pp.person_id
  where v.journal_share_token is not null and v.journal_share_token = p_share_token
  order by pp.created_at;
$$;

grant execute on function public.get_public_journal_travelers(uuid) to anon, authenticated;

-- Date à laquelle un contenu (film/série/jeu) a été marqué comme vu/acheté — permet de classer
-- l'historique "Vus" par année plutôt que par date d'ajout à la liste.
alter table public.media_items
  add column if not exists watched_at timestamptz;
