-- Réactions (emoji) et commentaires sur les publications du journal, y compris de la part de
-- visiteurs anonymes du lien de partage public — identifiés par un prénom saisi une fois côté
-- visiteur (stocké en clair, aucune donnée sensible), pour que l'auteur du voyage sache "à qui il
-- a affaire". L'auteur peut répondre aux commentaires (réponse imbriquée, is_owner_reply = true).

create table if not exists public.journal_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.voyage_journal_posts(id) on delete cascade,
  visitor_name text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, visitor_name)
);

alter table public.journal_post_reactions enable row level security;

-- Lecture réservée aux collaborateurs du voyage (vue "propriétaire") : les visiteurs publics lisent
-- via get_public_journal_reactions (SECURITY DEFINER) plus bas, jamais directement la table.
create policy "journal_post_reactions_select_access"
  on public.journal_post_reactions for select
  using (
    exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), false)
    )
  );

create table if not exists public.journal_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.voyage_journal_posts(id) on delete cascade,
  parent_comment_id uuid references public.journal_post_comments(id) on delete cascade,
  author_name text not null,
  is_owner_reply boolean not null default false,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.journal_post_comments enable row level security;

create policy "journal_post_comments_select_access"
  on public.journal_post_comments for select
  using (
    exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), false)
    )
  );

-- L'auteur/les collaborateurs du voyage répondent directement (RLS, pas de RPC nécessaire), mais
-- uniquement en tant que réponse identifiée comme telle : un commentaire de visiteur passe
-- toujours par add_public_journal_comment (SECURITY DEFINER) plus bas.
create policy "journal_post_comments_owner_reply_insert"
  on public.journal_post_comments for insert
  with check (
    is_owner_reply = true
    and exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), true)
    )
  );

create policy "journal_post_comments_owner_delete"
  on public.journal_post_comments for delete
  using (
    exists (
      select 1 from public.voyage_journal_posts p
      where p.id = post_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), true)
    )
  );

-- Accès public (visiteurs anonymes du lien de partage), contourne la RLS via SECURITY DEFINER,
-- sur le même modèle que get_public_journal (0033) : ne renvoie/n'accepte jamais rien pour un
-- voyage sans token actif.

create or replace function public.get_public_journal_reactions(p_share_token uuid)
returns table (
  post_id uuid,
  emoji text,
  visitor_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select r.post_id, r.emoji, r.visitor_name
  from public.journal_post_reactions r
  join public.voyage_journal_posts p on p.id = r.post_id
  join public.voyages v on v.id = p.voyage_id
  where v.journal_share_token is not null and v.journal_share_token = p_share_token;
$$;

grant execute on function public.get_public_journal_reactions(uuid) to anon, authenticated;

create or replace function public.set_public_journal_reaction(
  p_share_token uuid,
  p_post_id uuid,
  p_visitor_name text,
  p_emoji text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(p_visitor_name) = '' or trim(p_emoji) = '' then
    raise exception 'Prénom et réaction requis';
  end if;

  if not exists (
    select 1 from public.voyage_journal_posts p
    join public.voyages v on v.id = p.voyage_id
    where p.id = p_post_id and v.journal_share_token is not null and v.journal_share_token = p_share_token
  ) then
    raise exception 'Publication introuvable pour ce lien de partage';
  end if;

  insert into public.journal_post_reactions (post_id, visitor_name, emoji)
  values (p_post_id, trim(p_visitor_name), p_emoji)
  on conflict (post_id, visitor_name)
  do update set emoji = excluded.emoji, created_at = now();
end;
$$;

grant execute on function public.set_public_journal_reaction(uuid, uuid, text, text) to anon, authenticated;

create or replace function public.remove_public_journal_reaction(
  p_share_token uuid,
  p_post_id uuid,
  p_visitor_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.journal_post_reactions r
  using public.voyage_journal_posts p, public.voyages v
  where r.post_id = p.id
    and p.voyage_id = v.id
    and r.post_id = p_post_id
    and r.visitor_name = trim(p_visitor_name)
    and v.journal_share_token is not null
    and v.journal_share_token = p_share_token;
end;
$$;

grant execute on function public.remove_public_journal_reaction(uuid, uuid, text) to anon, authenticated;

create or replace function public.get_public_journal_comments(p_share_token uuid)
returns table (
  id uuid,
  post_id uuid,
  parent_comment_id uuid,
  author_name text,
  is_owner_reply boolean,
  content text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.post_id, c.parent_comment_id, c.author_name, c.is_owner_reply, c.content, c.created_at
  from public.journal_post_comments c
  join public.voyage_journal_posts p on p.id = c.post_id
  join public.voyages v on v.id = p.voyage_id
  where v.journal_share_token is not null and v.journal_share_token = p_share_token
  order by c.created_at asc;
$$;

grant execute on function public.get_public_journal_comments(uuid) to anon, authenticated;

create or replace function public.add_public_journal_comment(
  p_share_token uuid,
  p_post_id uuid,
  p_visitor_name text,
  p_content text,
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if trim(p_visitor_name) = '' or trim(p_content) = '' then
    raise exception 'Prénom et commentaire requis';
  end if;

  if not exists (
    select 1 from public.voyage_journal_posts p
    join public.voyages v on v.id = p.voyage_id
    where p.id = p_post_id and v.journal_share_token is not null and v.journal_share_token = p_share_token
  ) then
    raise exception 'Publication introuvable pour ce lien de partage';
  end if;

  if p_parent_comment_id is not null and not exists (
    select 1 from public.journal_post_comments where id = p_parent_comment_id and post_id = p_post_id
  ) then
    raise exception 'Commentaire parent introuvable';
  end if;

  insert into public.journal_post_comments (post_id, parent_comment_id, author_name, is_owner_reply, content)
  values (p_post_id, p_parent_comment_id, trim(p_visitor_name), false, trim(p_content))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_public_journal_comment(uuid, uuid, text, text, uuid) to anon, authenticated;
