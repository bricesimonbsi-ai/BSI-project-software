-- La migration précédente (0025) a échoué : "create or replace view" refuse de changer la
-- position des colonnes existantes d'une vue, et ne peut ajouter des colonnes qu'à la toute fin.
-- Comme sub_category/is_estimated (ajoutées à voyage_expenses en 0019) doivent s'insérer au
-- milieu de la liste de colonnes existante de voyage_all_expenses (avant resolved_voyage_id...),
-- un simple "create or replace" ne suffit pas : il faut supprimer la vue puis la recréer.
--
-- voyage_budget_summary, voyage_category_budget_summary et voyage_person_expense_summary
-- dépendent toutes de voyage_all_expenses (directement ou via une sous-requête) : les supprimer
-- avec elle (cascade) puis les recréer à l'identique dans la foulée. Aucune table ni donnée
-- n'est touchée : ce sont uniquement des vues (des requêtes nommées), qui ne stockent rien.
-- Migration additive du point de vue des données (aucune perte), même si elle recrée du schéma.

drop view if exists public.voyage_all_expenses cascade;

create view public.voyage_all_expenses
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

create view public.voyage_budget_summary
with (security_invoker = true) as
select
  v.id as voyage_id,
  v.project_id,
  sum(x.amount * x.manual_rate_to_reference) filter (where x.planned) as total_planned,
  sum(x.amount * x.manual_rate_to_reference) filter (where not x.planned) as total_actual
from public.voyages v
left join lateral (
  select amount, manual_rate_to_reference, planned
  from public.voyage_all_expenses
  where resolved_voyage_id = v.id
) x on true
group by v.id, v.project_id;

create view public.voyage_category_budget_summary
with (security_invoker = true) as
select
  resolved_voyage_id as voyage_id,
  category,
  sum(amount * manual_rate_to_reference) filter (where planned) as total_planned,
  sum(amount * manual_rate_to_reference) filter (where not planned) as total_actual
from public.voyage_all_expenses
where resolved_voyage_id is not null
group by resolved_voyage_id, category;

create view public.voyage_person_expense_summary
with (security_invoker = true) as
select
  p.id as person_id,
  v.id as voyage_id,
  p.name,
  sum(x.amount * x.manual_rate_to_reference) filter (where x.planned) as total_planned,
  sum(x.amount * x.manual_rate_to_reference) filter (where not x.planned) as total_actual
from public.people p
join public.project_people pp on pp.person_id = p.id
join public.voyages v on v.project_id = pp.project_id
left join public.voyage_all_expenses x on x.person_id = p.id and x.resolved_voyage_id = v.id
group by p.id, v.id, p.name;
