-- Genres/catégories d'un film ou d'une série (horreur, comédie, etc.), pour les regrouper dans
-- "Ma liste" et "Vu" — récupérés automatiquement depuis TMDB à l'ajout, éditables manuellement.
-- Additif, nullable : les contenus déjà ajoutés restent lisibles sans catégorie (repli "Autre").
alter table public.media_items add column if not exists genres text[];
