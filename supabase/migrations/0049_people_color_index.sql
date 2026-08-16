-- Couleur manuelle par personne : jusqu'ici la couleur (avatar + agenda) était purement
-- positionnelle (dérivée de la place de la personne dans la liste, voir AVATAR_COLOR_CLASSES).
-- Colonne nullable : null = comportement inchangé (couleur positionnelle) ; une valeur (0 à 5,
-- même palette à 6 couleurs) force cette couleur partout où la personne apparaît.

alter table public.people add column if not exists color_index integer check (color_index >= 0 and color_index <= 5);
