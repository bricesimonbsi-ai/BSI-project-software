-- Avatar personnalisable façon Bitmoji (DiceBear, généré côté client, aucun appel réseau) :
-- couleur de peau, coiffure, couleur de cheveux, accessoire. Colonne additive et nullable —
-- une personne sans avatar_config continue d'utiliser l'émoji/initiale existants
-- (voir PersonAvatarBadge). Rien n'est retiré ni modifié sur les données déjà saisies.
alter table public.people
  add column if not exists avatar_config jsonb;
