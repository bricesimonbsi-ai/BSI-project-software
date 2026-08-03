-- Catégories de projets : données modifiables par l'administrateur, pas codées en dur.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#64748b', -- couleur d'accent (hex)
  status text not null default 'active' check (status in ('active', 'archived')),
  position integer not null default 0,
  -- Identifie un module enrichi dédié (ex. 'voyages'), indépendamment du nom
  -- (renommable par l'admin) : null = gabarit de projet générique.
  module_key text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_authenticated"
  on public.categories for select
  using (auth.role() = 'authenticated');

create policy "categories_write_admin"
  on public.categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.categories (name, color, position, module_key) values
  ('Voyages', '#0ea5e9', 0, 'voyages'),
  ('Immobilier', '#a855f7', 1, null),
  ('Investissements', '#22c55e', 2, null),
  ('Santé & bien-être', '#f43f5e', 3, null),
  ('Administratif', '#64748b', 4, null),
  ('Projets créatifs/perso', '#f59e0b', 5, null),
  ('Quotidien', '#14b8a6', 6, null),
  ('Autre', '#78716c', 7, null)
on conflict (name) do nothing;
