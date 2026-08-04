-- Liste de personnes globale (paramétrable pour toute l'application), associable à
-- n'importe quel projet — remplace le panneau "voyageurs" propre à un seul voyage
-- (voyage_travelers, ajoutée en 0015, reste en base mais n'est plus utilisée par
-- l'application : migration additive, aucune table/colonne supprimée).

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  avatar_emoji text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.people enable row level security;

create policy "people_select_access"
  on public.people for select
  using (created_by = auth.uid());

create policy "people_write_access"
  on public.people for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Association d'une personne à un projet (plusieurs personnes par projet, une personne
-- réutilisable sur plusieurs projets).
create table if not exists public.project_people (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, person_id)
);

alter table public.project_people enable row level security;

create policy "project_people_select_access"
  on public.project_people for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "project_people_write_access"
  on public.project_people for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));

-- Rattachement optionnel d'une dépense à une personne (remplace voyage_expenses.traveler_id
-- ajouté en 0015, qui pointait vers voyage_travelers — non repris par l'application).
alter table public.voyage_expenses
  add column if not exists person_id uuid references public.people(id) on delete set null;

-- Dépenses réelles/prévisionnelles par personne associée au projet du voyage.
create or replace view public.voyage_person_expense_summary
with (security_invoker = true) as
select
  p.id as person_id,
  v.id as voyage_id,
  p.name,
  sum(e.amount * e.manual_rate_to_reference) filter (where e.planned) as total_planned,
  sum(e.amount * e.manual_rate_to_reference) filter (where not e.planned) as total_actual
from public.voyages v
join public.project_people pp on pp.project_id = v.project_id
join public.people p on p.id = pp.person_id
left join public.voyage_expenses e on e.person_id = p.id
group by p.id, v.id, p.name;
