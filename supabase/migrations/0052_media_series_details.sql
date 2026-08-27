-- Nombre de saisons/épisodes d'une série (TMDB /tv/{id}, absent des résultats de recherche —
-- récupéré séparément à l'ajout, même principe que les plateformes de streaming). Nullable,
-- pertinent seulement pour type='serie' (jamais renseigné pour films/jeux).

alter table public.media_items add column if not exists season_count integer;
alter table public.media_items add column if not exists episode_count integer;
