-- Retire la catégorisation par occasion (anniversaire/Noël/autre) du module Cadeaux : une seule
-- liste d'idées par personne, sans distinction d'occasion à saisir ni à afficher.
alter table public.gift_items drop column if exists occasion;
