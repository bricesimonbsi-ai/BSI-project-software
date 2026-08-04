-- Voyageurs nommés (nom + avatar) et compléments budget (style de voyage, nombre de
-- logements, budget cible par personne, rattachement optionnel dépense -> voyageur).
-- Migration additive : aucune colonne/table existante modifiée ou supprimée.

create table if not exists public.voyage_travelers (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  name text not null,
  avatar_emoji text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voyage_travelers enable row level security;

create policy "voyage_travelers_select_access"
  on public.voyage_travelers for select
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), false));

create policy "voyage_travelers_write_access"
  on public.voyage_travelers for all
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true))
  with check (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true));

alter table public.voyages
  add column if not exists lodging_count integer check (lodging_count >= 0),
  add column if not exists travel_style text check (travel_style in ('economique', 'standard', 'confort')),
  add column if not exists budget_target_per_person numeric(12,2);

alter table public.voyage_expenses
  add column if not exists traveler_id uuid references public.voyage_travelers(id) on delete set null;

-- Corrige voyage_budget_summary : la version initiale ne comptait que les dépenses
-- rattachées directement au voyage (catégories avant-départ), en ignorant celles
-- rattachées à une sous-étape (catégories sur place) — le total affiché sous-estimait
-- donc systématiquement le budget réel du voyage. Le "join lateral" sur l'union des
-- deux portées évite le produit cartésien qu'aurait provoqué un simple left join.
create or replace view public.voyage_budget_summary
with (security_invoker = true) as
select
  v.id as voyage_id,
  v.project_id,
  sum(x.amount * x.manual_rate_to_reference) filter (where x.planned) as total_planned,
  sum(x.amount * x.manual_rate_to_reference) filter (where not x.planned) as total_actual
from public.voyages v
left join lateral (
  select e.amount, e.manual_rate_to_reference, e.planned
  from public.voyage_expenses e
  where e.voyage_id = v.id
  union all
  select e.amount, e.manual_rate_to_reference, e.planned
  from public.voyage_expenses e
  join public.voyage_sous_etapes se on se.id = e.sous_etape_id
  join public.voyage_etapes et on et.id = se.etape_id
  where et.voyage_id = v.id
) x on true
group by v.id, v.project_id;

-- Indicateurs par grande catégorie de dépense (avant-départ + sur place confondues).
create or replace view public.voyage_category_budget_summary
with (security_invoker = true) as
select
  v.id as voyage_id,
  e.category,
  sum(e.amount * e.manual_rate_to_reference) filter (where e.planned) as total_planned,
  sum(e.amount * e.manual_rate_to_reference) filter (where not e.planned) as total_actual
from public.voyages v
join public.voyage_expenses e on e.voyage_id = v.id
  or e.sous_etape_id in (
    select se.id from public.voyage_sous_etapes se
    join public.voyage_etapes et on et.id = se.etape_id
    where et.voyage_id = v.id
  )
group by v.id, e.category;

-- Dépenses réelles par voyageur (quand une dépense est rattachée à une personne).
create or replace view public.voyage_traveler_expense_summary
with (security_invoker = true) as
select
  t.id as traveler_id,
  t.voyage_id,
  t.name,
  sum(e.amount * e.manual_rate_to_reference) filter (where e.planned) as total_planned,
  sum(e.amount * e.manual_rate_to_reference) filter (where not e.planned) as total_actual
from public.voyage_travelers t
left join public.voyage_expenses e on e.traveler_id = t.id
group by t.id, t.voyage_id, t.name;
