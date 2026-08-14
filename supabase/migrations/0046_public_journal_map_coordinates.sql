-- Ajoute latitude/longitude à la fonction publique get_public_journal, pour permettre l'affichage
-- de la vue "Carte" (façon Polarsteps) aussi sur le lien de partage public (visiteurs anonymes),
-- au même titre que la vue Carte déjà disponible côté propriétaire. `drop` + recréation requis :
-- Postgres ne permet pas d'étendre la liste de colonnes d'une fonction `returns table` existante
-- via `create or replace` seul. Aucune donnée supprimée, uniquement la fonction recréée.

drop function if exists public.get_public_journal(uuid);

create function public.get_public_journal(p_share_token uuid)
returns table (
  post_id uuid,
  caption text,
  entry_date date,
  created_at timestamptz,
  author_name text,
  city text,
  country_region text,
  photo_paths text[],
  latitude double precision,
  longitude double precision
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.caption,
    p.entry_date,
    p.created_at,
    p.author_name,
    se.city,
    e.country_region,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position) from public.voyage_journal_photos ph where ph.post_id = p.id),
      '{}'::text[]
    ),
    se.latitude,
    se.longitude
  from public.voyage_journal_posts p
  join public.voyages v on v.id = p.voyage_id
  left join public.voyage_sous_etapes se on se.id = p.sous_etape_id
  left join public.voyage_etapes e on e.id = se.etape_id
  where v.journal_share_token = p_share_token
  order by p.entry_date desc, p.created_at desc;
$$;

grant execute on function public.get_public_journal(uuid) to anon, authenticated;
