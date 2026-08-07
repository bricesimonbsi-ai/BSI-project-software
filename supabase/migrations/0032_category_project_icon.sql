-- Icône/emoji personnalisable pour une catégorie de projet et pour un projet lui-même
-- (sélectionnée via un picker façon clavier iOS/Android, entièrement côté client).
-- Colonnes additives et nullables : aucune donnée existante modifiée, l'absence d'icône
-- retombe simplement sur l'affichage actuel (pas d'icône).
alter table public.categories
  add column if not exists icon text;

alter table public.projects
  add column if not exists icon text;
