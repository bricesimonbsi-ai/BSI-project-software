-- Dépenses de voyage : rattachées au voyage (catégories avant-départ) ou à une
-- sous-étape (catégories sur place). Prévisionnel vs réel via le flag "planned".
-- Choix par défaut (à valider) : pas d'API de taux de change ; taux saisi
-- manuellement par dépense (manual_rate_to_reference), défaut 1.

create table if not exists public.voyage_expenses (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid references public.voyages(id) on delete cascade,
  sous_etape_id uuid references public.voyage_sous_etapes(id) on delete cascade,
  category text not null check (category in (
    -- avant-départ
    'equipement', 'transport_international', 'assurance', 'visas', 'vaccins',
    'administratif', 'vehicule', 'financement', 'imprevus', 'frais_bancaires',
    -- sur place
    'logement', 'nourriture', 'activites', 'transport_local'
  )),
  planned boolean not null default true,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  manual_rate_to_reference numeric(14,6) not null default 1,
  description text,
  expense_date date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voyage_expenses_one_parent check (
    (voyage_id is not null and sous_etape_id is null) or
    (voyage_id is null and sous_etape_id is not null)
  )
);

alter table public.voyage_expenses enable row level security;

create or replace function public.expense_project_id(
  p_voyage_id uuid, p_sous_etape_id uuid
)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    public.voyage_project_id(p_voyage_id),
    public.sous_etape_project_id(p_sous_etape_id)
  );
$$;

create policy "voyage_expenses_select_access"
  on public.voyage_expenses for select
  using (public.has_project_access(public.expense_project_id(voyage_id, sous_etape_id), auth.uid(), false));

create policy "voyage_expenses_write_access"
  on public.voyage_expenses for all
  using (public.has_project_access(public.expense_project_id(voyage_id, sous_etape_id), auth.uid(), true))
  with check (public.has_project_access(public.expense_project_id(voyage_id, sous_etape_id), auth.uid(), true));

-- Vues d'agrégation budget prévisionnel vs réel.
-- security_invoker garantit que les RLS des tables sous-jacentes s'appliquent
-- selon l'utilisateur appelant (et non le propriétaire de la vue).
create or replace view public.voyage_budget_summary
with (security_invoker = true) as
select
  v.id as voyage_id,
  v.project_id,
  sum(e.amount * e.manual_rate_to_reference) filter (where e.planned) as total_planned,
  sum(e.amount * e.manual_rate_to_reference) filter (where not e.planned) as total_actual
from public.voyages v
left join public.voyage_expenses e on e.voyage_id = v.id
group by v.id, v.project_id;

create or replace view public.voyage_etape_budget_summary
with (security_invoker = true) as
select
  e.id as etape_id,
  e.voyage_id,
  sum(ex.amount * ex.manual_rate_to_reference) filter (where ex.planned) as total_planned,
  sum(ex.amount * ex.manual_rate_to_reference) filter (where not ex.planned) as total_actual
from public.voyage_etapes e
left join public.voyage_sous_etapes se on se.etape_id = e.id
left join public.voyage_expenses ex on ex.sous_etape_id = se.id
group by e.id, e.voyage_id;
