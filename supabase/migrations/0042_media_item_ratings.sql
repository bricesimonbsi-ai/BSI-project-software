-- Note personnelle (/10) + commentaire libre sur un contenu média, par personne (répertoire
-- "people", identifie qui a donné la note) — une seule note par personne et par contenu, modifiable
-- dans le temps (upsert applicatif sur la contrainte unique ci-dessous, jamais un historique).

create table if not exists public.media_item_ratings (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  rating numeric(3,1) not null check (rating >= 0 and rating <= 10),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_item_id, person_id)
);

alter table public.media_item_ratings enable row level security;

create policy "media_item_ratings_select_access"
  on public.media_item_ratings for select
  using (
    exists (
      select 1 from public.media_items m
      where m.id = media_item_id and public.has_project_access(m.project_id, auth.uid(), false)
    )
  );

create policy "media_item_ratings_write_access"
  on public.media_item_ratings for all
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
