-- Import CSV du relevé bancaire : chaque dépense importée est marquée "source" (carte/retrait)
-- pour rester identifiable dans le tableau, et "needs_review" tant qu'elle n'a pas été vérifiée
-- manuellement (pastille "à valider"). Un retrait d'espèces n'est jamais importé tel quel : il
-- est ventilé immédiatement entre transport sur place / activités / nourriture selon les
-- pourcentages `cash_split_ratios` du voyage (mémorisés une fois, réutilisés à chaque import).
-- Toutes les colonnes sont additives (nullable ou avec valeur par défaut) : aucune dépense déjà
-- saisie n'est affectée.

alter table public.voyage_expenses add column if not exists source text;
alter table public.voyage_expenses drop constraint if exists voyage_expenses_source_check;
alter table public.voyage_expenses add constraint voyage_expenses_source_check check (source is null or source in ('carte', 'retrait'));

alter table public.voyage_expenses add column if not exists needs_review boolean not null default false;

alter table public.voyages add column if not exists cash_split_ratios jsonb not null default '{"transport_local":15,"activites":40,"nourriture":45}'::jsonb;

-- voyage_all_expenses sélectionne "e.*" : Postgres fige la liste de colonnes au moment du CREATE
-- VIEW, donc les deux nouvelles colonnes ci-dessus n'apparaîtraient pas dans la vue tant qu'elle
-- n'est pas recréée (même mécanisme que la migration 0026). drop cascade + recréation à
-- l'identique des 3 vues qui en dépendent : aucune table ni donnée n'est touchée.
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
