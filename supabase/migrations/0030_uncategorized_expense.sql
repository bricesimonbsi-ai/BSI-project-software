-- Une dépense importée depuis un CSV peut désormais rester sans catégorie choisie à l'import
-- (voir expense-import-dialog.tsx) : elle est alors marquée 'non_categorise' en attendant d'être
-- affectée à une vraie catégorie depuis le nouvel onglet "Gérer mes dépenses" — juste une valeur
-- de plus autorisée par la contrainte existante, aucune donnée déjà saisie n'est affectée.

alter table public.voyage_expenses drop constraint if exists voyage_expenses_category_check;
alter table public.voyage_expenses add constraint voyage_expenses_category_check check (category in (
  'transport', 'logement', 'nourriture', 'activites', 'equipement', 'administratif_sante',
  'non_categorise',
  'transport_international', 'transport_local', 'assurance', 'visas', 'vaccins',
  'administratif', 'vehicule', 'financement', 'imprevus', 'frais_bancaires'
));
