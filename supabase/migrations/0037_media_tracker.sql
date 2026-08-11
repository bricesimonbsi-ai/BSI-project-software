-- Module "Séries, Films et Jeux vidéo" : nouvelle catégorie dédiée, sur le même principe que
-- Voyages/Courses. Un seul projet suffit généralement dans cette catégorie (une bibliothèque
-- personnelle), mais rien n'empêche d'en créer plusieurs (ex. une par foyer). Le contenu est
-- réparti en 3 types au sein d'un même projet (onglets côté UI), pas 3 tables séparées, pour
-- garder un seul flux de partage/collaborateurs.

insert into public.categories (name, color, icon, position, module_key) values
  ('Séries, Films et Jeux vidéo', '#ec4899', '🎬', 9, 'media')
on conflict (name) do nothing;

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('film', 'serie', 'jeu')),
  -- Identifiant externe (TMDB pour film/série, futur pour jeu) : permet d'éviter les doublons et
  -- de retourner enrichir l'entrée plus tard (nouvelle saison, etc.), jamais utilisé pour l'accès.
  external_id text,
  title text not null,
  poster_path text,
  synopsis text,
  release_date date,
  external_rating numeric(3,1),
  platform text,
  watched boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_items enable row level security;

create policy "media_items_select_access"
  on public.media_items for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "media_items_write_access"
  on public.media_items for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));
