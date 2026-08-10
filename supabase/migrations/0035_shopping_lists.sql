-- Module "Liste de courses" : nouvelle catégorie dédiée ("Courses"), sur le même principe que
-- "Voyages" (module_key + template de détail spécifique). Chaque projet de cette catégorie est
-- une liste de courses ; le partage à un collaborateur réutilise le mécanisme déjà existant
-- (project_collaborators), aucune table supplémentaire nécessaire pour ça.

insert into public.categories (name, color, icon, position, module_key) values
  ('Courses', '#f97316', '🛒', 8, 'courses')
on conflict (name) do nothing;

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  quantity text,
  icon text,
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_list_items enable row level security;

create policy "shopping_list_items_select_access"
  on public.shopping_list_items for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "shopping_list_items_write_access"
  on public.shopping_list_items for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));
