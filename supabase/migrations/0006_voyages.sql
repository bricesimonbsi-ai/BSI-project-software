-- Module Voyages : voyage (1:1 avec un projet) -> étapes (pays/région) -> sous-étapes (ville/lieu).

create table if not exists public.voyages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  start_date date,
  end_date date,
  adults_count integer not null default 1 check (adults_count >= 0),
  children_count integer not null default 0 check (children_count >= 0),
  reference_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voyages enable row level security;

create policy "voyages_select_access"
  on public.voyages for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "voyages_write_access"
  on public.voyages for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));

create table if not exists public.voyage_etapes (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  country_region text not null,
  arrival_date date,
  duration_days integer check (duration_days >= 0),
  visa_needed boolean not null default false,
  vaccines text,
  transport_mode text,
  intl_permit_needed boolean not null default false,
  security_notes text,
  notes text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voyage_etapes enable row level security;

create or replace function public.voyage_project_id(vid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select project_id from public.voyages where id = vid;
$$;

create or replace function public.etape_project_id(eid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select v.project_id from public.voyage_etapes e join public.voyages v on v.id = e.voyage_id where e.id = eid;
$$;

create policy "voyage_etapes_select_access"
  on public.voyage_etapes for select
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), false));

create policy "voyage_etapes_write_access"
  on public.voyage_etapes for all
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true))
  with check (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true));

create table if not exists public.voyage_sous_etapes (
  id uuid primary key default gen_random_uuid(),
  etape_id uuid not null references public.voyage_etapes(id) on delete cascade,
  city text not null,
  start_date date,
  end_date date,
  duration_days integer check (duration_days >= 0),
  lodging text,
  activities text,
  transport_next_mode text,
  transport_next_duration_hours numeric(6,2),
  transport_next_cost numeric(12,2),
  transport_next_currency text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voyage_sous_etapes enable row level security;

create or replace function public.sous_etape_project_id(seid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select v.project_id
  from public.voyage_sous_etapes se
  join public.voyage_etapes e on e.id = se.etape_id
  join public.voyages v on v.id = e.voyage_id
  where se.id = seid;
$$;

create policy "voyage_sous_etapes_select_access"
  on public.voyage_sous_etapes for select
  using (public.has_project_access(public.etape_project_id(etape_id), auth.uid(), false));

create policy "voyage_sous_etapes_write_access"
  on public.voyage_sous_etapes for all
  using (public.has_project_access(public.etape_project_id(etape_id), auth.uid(), true))
  with check (public.has_project_access(public.etape_project_id(etape_id), auth.uid(), true));
