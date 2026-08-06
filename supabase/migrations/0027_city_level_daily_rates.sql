-- Les taux journaliers (logement/nuit, nourriture/jour, transport sur place/jour) étaient
-- overridables uniquement au niveau du PAYS (voyage_etapes), donc partagés par toutes les
-- villes de ce pays — modifier le taux pour une ville modifiait le montant affiché pour
-- toutes les autres villes du même pays, ce qui n'est pas le comportement attendu : chaque
-- ville doit pouvoir ajuster son propre taux indépendamment. Ajoute les mêmes colonnes au
-- niveau ville (voyage_sous_etapes). Les colonnes existantes sur voyage_etapes ne sont pas
-- supprimées (aucune perte de donnée), mais l'application n'écrit plus dedans désormais.
-- Migration additive.

alter table public.voyage_sous_etapes
  add column if not exists lodging_cost_per_night numeric(10,2),
  add column if not exists food_cost_per_day numeric(10,2),
  add column if not exists local_transport_cost_per_day numeric(10,2);
