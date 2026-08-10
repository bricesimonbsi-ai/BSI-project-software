-- Rayon (catégorie) d'un article de liste de courses (ex. "Fruits et légumes", "Alcool"),
-- suggéré automatiquement à la saisie côté client — colonne additive et nullable, aucune donnée
-- existante affectée.
alter table public.shopping_list_items
  add column if not exists category text;
