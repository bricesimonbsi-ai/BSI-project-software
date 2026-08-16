-- Module "Cadeaux" : nouvelle catégorie dédiée, sur le même principe que "Courses"/"Médias"
-- (module_key + template de détail spécifique). Chaque projet de cette catégorie est une liste
-- d'idées de cadeaux (anniversaire, Noël...) pour une ou plusieurs personnes du répertoire
-- "Personnes" déjà existant — aucune nouvelle table de personnes nécessaire.

insert into public.categories (name, color, icon, position, module_key) values
  ('Cadeaux', '#f43f5e', '🎁', 11, 'cadeaux')
on conflict (name) do nothing;

create table if not exists public.gift_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  -- Personne visée par l'idée (facultatif) ; si la personne est supprimée du répertoire, l'idée
  -- reste (juste délimitée), elle n'est pas perdue.
  person_id uuid references public.people(id) on delete set null,
  occasion text not null default 'autre' check (occasion in ('anniversaire', 'noel', 'autre')),
  status text not null default 'idee' check (status in ('idee', 'achete', 'offert')),
  price_estimate numeric,
  link text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gift_items enable row level security;

create policy "gift_items_select_access"
  on public.gift_items for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "gift_items_write_access"
  on public.gift_items for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));
