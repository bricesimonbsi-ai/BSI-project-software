-- Étend voyage_expenses pour supporter un rattachement au niveau pays (étape), en plus des
-- rattachements existants voyage (transverse) et sous-étape (ville) — nécessaire pour des
-- dépenses propres à un pays entier (ex. visa) sans les dupliquer sur chaque ville. Ajoute
-- aussi une vue de détail plate (une ligne par dépense, avec ville/pays résolus) pour que le
-- budget prévisionnel/réel se recalcule toujours correctement côté client à partir d'une
-- source unique, quel que soit le niveau de rattachement. Migration additive.

alter table public.voyage_expenses
  add column if not exists etape_id uuid references public.voyage_etapes(id) on delete cascade;

alter table public.voyage_expenses drop constraint if exists voyage_expenses_one_parent;
alter table public.voyage_expenses add constraint voyage_expenses_one_parent check (
  (voyage_id is not null and sous_etape_id is null and etape_id is null) or
  (voyage_id is null and sous_etape_id is not null and etape_id is null) or
  (voyage_id is null and sous_etape_id is null and etape_id is not null)
);

create or replace function public.expense_project_id(
  p_voyage_id uuid, p_sous_etape_id uuid, p_etape_id uuid default null
)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    public.voyage_project_id(p_voyage_id),
    public.sous_etape_project_id(p_sous_etape_id),
    public.etape_project_id(p_etape_id)
  );
$$;

drop policy if exists "voyage_expenses_select_access" on public.voyage_expenses;
drop policy if exists "voyage_expenses_write_access" on public.voyage_expenses;

create policy "voyage_expenses_select_access"
  on public.voyage_expenses for select
  using (public.has_project_access(public.expense_project_id(voyage_id, sous_etape_id, etape_id), auth.uid(), false));

create policy "voyage_expenses_write_access"
  on public.voyage_expenses for all
  using (public.has_project_access(public.expense_project_id(voyage_id, sous_etape_id, etape_id), auth.uid(), true))
  with check (public.has_project_access(public.expense_project_id(voyage_id, sous_etape_id, etape_id), auth.uid(), true));

-- Vue de détail plate : une ligne par dépense, avec le voyage/pays/ville résolus quel que
-- soit le niveau de rattachement — sert de source unique pour tout calcul de budget côté
-- client (vue d'ensemble par ville/pays, transverses, totaux), sans duplication de logique.
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

-- Les vues d'agrégation existantes doivent aussi compter les dépenses de niveau pays
-- (etape_id), en plus de voyage_id et sous_etape_id déjà couverts.
create or replace view public.voyage_budget_summary
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

create or replace view public.voyage_category_budget_summary
with (security_invoker = true) as
select
  resolved_voyage_id as voyage_id,
  category,
  sum(amount * manual_rate_to_reference) filter (where planned) as total_planned,
  sum(amount * manual_rate_to_reference) filter (where not planned) as total_actual
from public.voyage_all_expenses
where resolved_voyage_id is not null
group by resolved_voyage_id, category;

create or replace view public.voyage_person_expense_summary
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
