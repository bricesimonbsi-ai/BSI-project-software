-- Permet de viser une idée de cadeau à quelqu'un sans l'ajouter au répertoire "Personnes" (ex.
-- un collègue ou une connaissance ponctuelle) : nom libre en plus du lien optionnel vers une
-- personne du répertoire. Les deux sont mutuellement exclusifs, gérés côté application.
alter table public.gift_items add column if not exists person_name text;
