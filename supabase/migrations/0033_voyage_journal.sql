-- Journal de voyage façon Polarsteps : des "posts" (photos + texte, rattachés en option à une
-- ville de l'itinéraire) publiés par le créateur du voyage et ses collaborateurs en écriture,
-- consultables dans l'app, et partageables via un lien public (aucune authentification requise
-- pour le visiteur) tant que le voyage a un journal_share_token actif.

create table if not exists public.voyage_journal_posts (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  -- Nom de l'auteur dénormalisé au moment de la publication : la RLS de "profiles" limite la
  -- lecture d'un profil à son propriétaire (voir 0001), donc un join profiles(display_name) ne
  -- fonctionnerait pas pour afficher l'auteur d'un post écrit par quelqu'un d'autre.
  author_name text not null default 'Voyageur',
  sous_etape_id uuid references public.voyage_sous_etapes(id) on delete set null,
  caption text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voyage_journal_posts enable row level security;

create policy "voyage_journal_posts_select_access"
  on public.voyage_journal_posts for select
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), false));

create policy "voyage_journal_posts_write_access"
  on public.voyage_journal_posts for all
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true))
  with check (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true));

create table if not exists public.voyage_journal_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.voyage_journal_posts(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.voyage_journal_photos enable row level security;

create policy "voyage_journal_photos_select_access"
  on public.voyage_journal_photos for select
  using (
    exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), false)
    )
  );

create policy "voyage_journal_photos_write_access"
  on public.voyage_journal_photos for all
  using (
    exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), true)
    )
  )
  with check (
    exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), true)
    )
  );

-- Lien de partage public : présence d'un token = partage actif. Régénérer (nouvelle valeur) ou
-- mettre à null (désactiver) se fait via une simple mise à jour de voyages, déjà couverte par sa
-- policy d'écriture existante — aucune policy supplémentaire nécessaire pour cette colonne.
alter table public.voyages add column if not exists journal_share_token uuid;

create unique index if not exists voyages_journal_share_token_idx
  on public.voyages (journal_share_token)
  where journal_share_token is not null;

-- Accès public en lecture seule, contourne la RLS via SECURITY DEFINER : ne renvoie jamais rien
-- pour un voyage sans token actif, et le token (uuid aléatoire, non énumérable) fait office de
-- secret. Aucune donnée sensible (budget, dépenses...) n'est exposée, uniquement le journal.
create or replace function public.get_public_journal(p_share_token uuid)
returns table (
  post_id uuid,
  caption text,
  entry_date date,
  created_at timestamptz,
  author_name text,
  city text,
  country_region text,
  photo_paths text[]
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.caption,
    p.entry_date,
    p.created_at,
    p.author_name,
    se.city,
    e.country_region,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position) from public.voyage_journal_photos ph where ph.post_id = p.id),
      '{}'::text[]
    )
  from public.voyage_journal_posts p
  join public.voyages v on v.id = p.voyage_id
  left join public.voyage_sous_etapes se on se.id = p.sous_etape_id
  left join public.voyage_etapes e on e.id = se.etape_id
  where v.journal_share_token is not null and v.journal_share_token = p_share_token
  order by p.entry_date desc, p.created_at desc;
$$;

grant execute on function public.get_public_journal(uuid) to anon, authenticated;

create or replace function public.get_public_journal_meta(p_share_token uuid)
returns table (
  voyage_id uuid,
  title text,
  icon text,
  start_date date,
  end_date date
)
language sql
security definer
stable
set search_path = public
as $$
  select v.id, pr.title, pr.icon, v.start_date, v.end_date
  from public.voyages v
  join public.projects pr on pr.id = v.project_id
  where v.journal_share_token is not null and v.journal_share_token = p_share_token;
$$;

grant execute on function public.get_public_journal_meta(uuid) to anon, authenticated;

-- Bucket public : les photos du journal sont censées être vues par des visiteurs sans compte via
-- le lien de partage, donc une URL publique directe (pas d'URL signée à renouveler).
insert into storage.buckets (id, name, public)
values ('voyage-journal', 'voyage-journal', true)
on conflict (id) do nothing;

-- Chemin attendu : {voyage_id}/{filename}.
create policy "voyage_journal_photos_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'voyage-journal'
    and public.has_project_access(public.voyage_project_id((storage.foldername(name))[1]::uuid), auth.uid(), false)
  );

create policy "voyage_journal_photos_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'voyage-journal'
    and public.has_project_access(public.voyage_project_id((storage.foldername(name))[1]::uuid), auth.uid(), true)
  );

create policy "voyage_journal_photos_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'voyage-journal'
    and public.has_project_access(public.voyage_project_id((storage.foldername(name))[1]::uuid), auth.uid(), true)
  );
