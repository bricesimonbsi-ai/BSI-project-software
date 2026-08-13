-- Module "Bars & Restaurants" : nouvelle catégorie dédiée, même principe que Médias (Nouveautés /
-- Ma liste / Visités / Synthèse), mais un seul type de contenu (pas de sélecteur de modèle à la
-- création, comme Voyages/Courses). "Où" est récupéré automatiquement via Google Places (adresse,
-- photo, note, horaires, téléphone, site) quand la clé est configurée ; sinon saisie manuelle.

insert into public.categories (name, color, icon, position, module_key) values
  ('Bars & Restaurants', '#ef4444', '🍽️', 10, 'restaurants')
on conflict (name) do nothing;

create table if not exists public.restaurant_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Identifiant Google Places (permet d'éviter les doublons), absent pour une entrée manuelle.
  place_id text,
  name text not null,
  address text,
  -- Tags de type/cuisine (ex. "Restaurant italien", "Bar à cocktails") — un tableau plutôt qu'un
  -- texte libre unique, un lieu pouvant relever de plusieurs catégories à la fois.
  categories text[] not null default '{}',
  photo_url text,
  google_rating numeric(2,1),
  price_level text,
  phone text,
  website text,
  -- Horaires lisibles par jour (ex. "lundi : 9h00-18h00"), tels que renvoyés par Google Places.
  opening_hours text[] not null default '{}',
  latitude double precision,
  longitude double precision,
  visited boolean not null default false,
  visited_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_items enable row level security;

create policy "restaurant_items_select_access"
  on public.restaurant_items for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "restaurant_items_write_access"
  on public.restaurant_items for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));

-- Qui a testé un lieu (plusieurs personnes possibles) — même principe que media_item_watchers.
create table if not exists public.restaurant_item_visitors (
  id uuid primary key default gen_random_uuid(),
  restaurant_item_id uuid not null references public.restaurant_items(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (restaurant_item_id, person_id)
);

alter table public.restaurant_item_visitors enable row level security;

create policy "restaurant_item_visitors_select_access"
  on public.restaurant_item_visitors for select
  using (
    exists (
      select 1 from public.restaurant_items r
      where r.id = restaurant_item_id and public.has_project_access(r.project_id, auth.uid(), false)
    )
  );

create policy "restaurant_item_visitors_write_access"
  on public.restaurant_item_visitors for all
  using (
    exists (
      select 1 from public.restaurant_items r
      where r.id = restaurant_item_id and public.has_project_access(r.project_id, auth.uid(), true)
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_items r
      where r.id = restaurant_item_id and public.has_project_access(r.project_id, auth.uid(), true)
    )
  );

-- Note personnelle (/10) + commentaire libre par personne, une seule note par personne et par
-- lieu, modifiable dans le temps (upsert applicatif) — même principe que media_item_ratings.
create table if not exists public.restaurant_item_ratings (
  id uuid primary key default gen_random_uuid(),
  restaurant_item_id uuid not null references public.restaurant_items(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  rating numeric(3,1) not null check (rating >= 0 and rating <= 10),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_item_id, person_id)
);

alter table public.restaurant_item_ratings enable row level security;

create policy "restaurant_item_ratings_select_access"
  on public.restaurant_item_ratings for select
  using (
    exists (
      select 1 from public.restaurant_items r
      where r.id = restaurant_item_id and public.has_project_access(r.project_id, auth.uid(), false)
    )
  );

create policy "restaurant_item_ratings_write_access"
  on public.restaurant_item_ratings for all
  using (
    exists (
      select 1 from public.restaurant_items r
      where r.id = restaurant_item_id and public.has_project_access(r.project_id, auth.uid(), true)
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_items r
      where r.id = restaurant_item_id and public.has_project_access(r.project_id, auth.uid(), true)
    )
  );
