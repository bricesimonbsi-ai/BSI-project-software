-- Passage du module Médias d'un projet unique multi-onglets à 3 modèles de projet dédiés (Films /
-- Séries / Jeux vidéo), choisis à la création — cf. l'itinéraire Voyages/Courses où chaque projet
-- est déjà d'un seul "genre". `projects.media_type` reste nullable et générique (aucun impact sur
-- les projets non-média) : la contrainte de valeur suffit, pas besoin de la restreindre par
-- module_key ici (déjà fait au niveau applicatif, comme pour hidesDates/hidesBudget).

alter table public.projects add column if not exists media_type text check (media_type in ('film', 'serie', 'jeu'));

-- "Où le voir" (plateformes de streaming, auto-récupérées via TMDB) ou "sur quelle console"
-- (jeux, sélection manuelle) : une liste plutôt qu'un texte libre, un contenu pouvant être
-- disponible à plusieurs endroits. L'ancienne colonne `platform` (texte libre) n'est plus utilisée
-- côté application mais reste en base (additive-only, jamais de perte de donnée déjà saisie).
alter table public.media_items add column if not exists platforms text[] not null default '{}';

-- Qui a vu/joué un contenu (plusieurs personnes possibles par contenu) — même principe que
-- project_people/voyage_travelers : des "personnes" nommées, pas forcément chacune un compte.
create table if not exists public.media_item_watchers (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (media_item_id, person_id)
);

alter table public.media_item_watchers enable row level security;

create policy "media_item_watchers_select_access"
  on public.media_item_watchers for select
  using (
    exists (
      select 1 from public.media_items m
      where m.id = media_item_id and public.has_project_access(m.project_id, auth.uid(), false)
    )
  );

create policy "media_item_watchers_write_access"
  on public.media_item_watchers for all
  using (
    exists (
      select 1 from public.media_items m
      where m.id = media_item_id and public.has_project_access(m.project_id, auth.uid(), true)
    )
  )
  with check (
    exists (
      select 1 from public.media_items m
      where m.id = media_item_id and public.has_project_access(m.project_id, auth.uid(), true)
    )
  );
