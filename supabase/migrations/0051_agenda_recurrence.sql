-- Récurrence des événements d'agenda (anniversaires annuels, virements mensuels...). Additive : la
-- valeur par défaut 'none' laisse tous les événements déjà créés inchangés (comportement actuel).
-- Les occurrences ne sont PAS matérialisées en lignes séparées : elles sont dérivées à la volée
-- côté client (voir src/features/agenda/recurrence.ts) à partir de ces 3 colonnes, dans la fenêtre
-- visible (grille du mois, liste "Prochains événements") — pas de table à faire grossir sans fin,
-- et modifier/supprimer agit sur toute la série (pas de gestion d'exceptions par occurrence, hors
-- périmètre demandé).

alter table public.agenda_events add column if not exists recurrence_freq text not null default 'none'
  check (recurrence_freq in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
alter table public.agenda_events add column if not exists recurrence_interval integer not null default 1
  check (recurrence_interval >= 1);
alter table public.agenda_events add column if not exists recurrence_end_date date;
