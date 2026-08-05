-- Prix unitaire estimé par article de matériel coché, ajustable individuellement (nul = utilise
-- le tarif indicatif par défaut côté client). Permet à l'onglet Équipement de proposer un coût
-- prévisionnel détaillé (article par article) plutôt qu'un seul montant forfaitaire pour tout le
-- matériel. Migration additive.

alter table public.voyage_equipment add column if not exists unit_price numeric(10,2);
