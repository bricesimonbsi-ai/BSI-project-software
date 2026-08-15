-- Modèle "Bar" ou "Restaurant" choisi à la création d'un projet de la catégorie "Bars &
-- Restaurants" — même principe que projects.media_type pour Films/Séries/Jeux vidéo. Nullable :
-- les projets déjà créés restent null et gardent leur comportement actuel (mixte bar+restaurant,
-- aucune restriction), exactement comme les anciens projets média sans media_type.

alter table public.projects add column if not exists restaurant_type text
  check (restaurant_type in ('bar', 'restaurant'));
