-- Permet d'ajuster manuellement, pays par pays, le forfait de transport sur place (taxis, bus
-- locaux, métro...) utilisé dans l'estimation budgétaire automatique (par jour et par
-- personne) — quand renseigné, remplace le forfait par défaut (5 EUR/jour/personne) pour ce
-- pays. Même principe que lodging_cost_per_night/food_cost_per_day (migration 0017).
-- Migration additive.

alter table public.voyage_etapes
  add column if not exists local_transport_cost_per_day numeric(10,2);
