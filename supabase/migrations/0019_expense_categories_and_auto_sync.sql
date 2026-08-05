-- Harmonise les catégories de dépenses dans toute l'application (transport, logement,
-- nourriture, activités, équipement, administratif & santé), avec un sous-type libre pour le
-- détail (mode de transport, type de frais administratif/santé). Les anciennes valeurs de
-- catégorie restent acceptées pour ne jamais invalider les dépenses déjà saisies (additif).
-- Ajoute aussi `is_estimated` pour distinguer un montant encore piloté par l'estimation
-- automatique (qui doit continuer à se resynchroniser tant qu'il n'est pas modifié à la main)
-- d'un montant ajusté manuellement (qui doit rester figé). Migration additive.

alter table public.voyage_expenses add column if not exists sub_category text;
alter table public.voyage_expenses add column if not exists is_estimated boolean not null default false;

alter table public.voyage_expenses drop constraint if exists voyage_expenses_category_check;
alter table public.voyage_expenses add constraint voyage_expenses_category_check check (category in (
  -- nouvelles catégories unifiées
  'transport', 'logement', 'nourriture', 'activites', 'equipement', 'administratif_sante',
  -- anciennes valeurs conservées pour compatibilité avec les dépenses déjà saisies
  'transport_international', 'transport_local', 'assurance', 'visas', 'vaccins',
  'administratif', 'vehicule', 'financement', 'imprevus', 'frais_bancaires'
));
