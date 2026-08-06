-- Bug racine : la vue voyage_all_expenses a été créée (migration 0018) avant l'ajout des
-- colonnes sub_category/is_estimated à voyage_expenses (migration 0019). En Postgres, "select
-- e.*" dans une vue fige la liste des colonnes au moment de la création de la vue — l'ajout de
-- colonnes à la table sous-jacente ensuite ne les propage PAS automatiquement à la vue tant
-- qu'elle n'est pas recréée. Résultat : toute lecture via voyage_all_expenses recevait
-- sub_category = undefined pour CHAQUE ligne, donc toute correspondance par sous-catégorie
-- (Administratif & santé, détail transport par mode...) échouait silencieusement — montants
-- saisis jamais retrouvés à l'affichage, totaux à 0, nouvelle ligne recréée à chaque saisie.
-- Recréer la vue à l'identique (aucune donnée touchée) force Postgres à ré-résoudre "e.*" avec
-- la liste de colonnes actuelle. Migration additive (aucune perte de données).

create or replace view public.voyage_all_expenses
with (security_invoker = true) as
select
  e.*,
  coalesce(v.id, se_et.voyage_id, et.voyage_id) as resolved_voyage_id,
  coalesce(et.id, se_et.id) as resolved_etape_id,
  coalesce(et.country_region, se_et.country_region) as country_region,
  se.city as city_name
from public.voyage_expenses e
left join public.voyages v on v.id = e.voyage_id
left join public.voyage_sous_etapes se on se.id = e.sous_etape_id
left join public.voyage_etapes se_et on se_et.id = se.etape_id
left join public.voyage_etapes et on et.id = e.etape_id;
