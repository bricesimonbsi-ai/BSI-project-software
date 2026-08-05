-- Permet d'ajuster manuellement, pays par pays, les tarifs utilisés dans l'estimation
-- budgétaire automatique (hébergement/nuit, nourriture/jour) — quand renseignés, ces
-- valeurs remplacent l'estimation automatique pour ce pays. Migration additive.

alter table public.voyage_etapes
  add column if not exists lodging_cost_per_night numeric(10,2),
  add column if not exists food_cost_per_day numeric(10,2);
