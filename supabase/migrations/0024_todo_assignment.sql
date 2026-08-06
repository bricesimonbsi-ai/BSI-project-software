-- Permet d'assigner une tâche à une personne précise (voyageur ou tout autre membre du
-- répertoire "people") ou à "tous les voyageurs" (assigned_to_all) — les deux restent
-- mutuellement exclusifs côté application, pas besoin de contrainte en base pour ça. Migration
-- additive.

alter table public.todos
  add column if not exists assigned_person_id uuid references public.people(id) on delete set null,
  add column if not exists assigned_to_all boolean not null default false;
