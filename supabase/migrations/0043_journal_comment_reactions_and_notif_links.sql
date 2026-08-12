-- 1) Les notifications de réaction/commentaire du journal (0040) ne portaient pas de quoi
-- construire un lien direct vers le contenu concerné — on y ajoute project_id/voyage_id.

create or replace function public.notify_journal_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_city text;
  v_voyage_id uuid;
  v_project_id uuid;
begin
  select p.author_id, se.city, v.id, v.project_id
    into v_author_id, v_city, v_voyage_id, v_project_id
  from public.voyage_journal_posts p
  join public.voyages v on v.id = p.voyage_id
  left join public.voyage_sous_etapes se on se.id = p.sous_etape_id
  where p.id = new.post_id;

  if v_author_id is not null then
    insert into public.notifications (user_id, type, title, body, payload)
    values (
      v_author_id,
      'journal_reaction',
      'Nouvelle réaction sur votre journal',
      new.visitor_name || ' a réagi ' || new.emoji || coalesce(' (' || v_city || ')', ''),
      jsonb_build_object(
        'post_id', new.post_id, 'emoji', new.emoji, 'visitor_name', new.visitor_name,
        'voyage_id', v_voyage_id, 'project_id', v_project_id
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_journal_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_voyage_id uuid;
  v_project_id uuid;
begin
  if new.is_owner_reply then
    return new;
  end if;

  select p.author_id, v.id, v.project_id
    into v_author_id, v_voyage_id, v_project_id
  from public.voyage_journal_posts p
  join public.voyages v on v.id = p.voyage_id
  where p.id = new.post_id;

  if v_author_id is not null then
    insert into public.notifications (user_id, type, title, body, payload)
    values (
      v_author_id,
      'journal_comment',
      'Nouveau commentaire sur votre journal',
      new.author_name || ' : ' || left(new.content, 140),
      jsonb_build_object(
        'post_id', new.post_id, 'comment_id', new.id, 'visitor_name', new.author_name,
        'voyage_id', v_voyage_id, 'project_id', v_project_id
      )
    );
  end if;
  return new;
end;
$$;

-- 2) Réactions (emoji) sur un commentaire du journal — même principe que journal_post_reactions
-- (0039), mais ciblant un commentaire plutôt qu'une publication. `is_owner` distingue la réaction
-- de l'auteur/collaborateur du voyage (identité connue, insérée directement via RLS) de celle d'un
-- visiteur anonyme (toujours via les RPC ci-dessous, jamais un accès direct à la table).

create table if not exists public.journal_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.journal_post_comments(id) on delete cascade,
  visitor_name text not null,
  emoji text not null,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (comment_id, visitor_name)
);

alter table public.journal_comment_reactions enable row level security;

create policy "journal_comment_reactions_select_access"
  on public.journal_comment_reactions for select
  using (
    exists (
      select 1 from public.journal_post_comments c
      join public.voyage_journal_posts p on p.id = c.post_id
      where c.id = comment_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), false)
    )
  );

create policy "journal_comment_reactions_owner_write"
  on public.journal_comment_reactions for all
  using (
    is_owner = true
    and exists (
      select 1 from public.journal_post_comments c
      join public.voyage_journal_posts p on p.id = c.post_id
      where c.id = comment_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), true)
    )
  )
  with check (
    is_owner = true
    and exists (
      select 1 from public.journal_post_comments c
      join public.voyage_journal_posts p on p.id = c.post_id
      where c.id = comment_id and public.has_project_access(public.voyage_project_id(p.voyage_id), auth.uid(), true)
    )
  );

create or replace function public.get_public_journal_comment_reactions(p_share_token uuid)
returns table (
  comment_id uuid,
  emoji text,
  visitor_name text,
  is_owner boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select r.comment_id, r.emoji, r.visitor_name, r.is_owner
  from public.journal_comment_reactions r
  join public.journal_post_comments c on c.id = r.comment_id
  join public.voyage_journal_posts p on p.id = c.post_id
  join public.voyages v on v.id = p.voyage_id
  where v.journal_share_token is not null and v.journal_share_token = p_share_token;
$$;

grant execute on function public.get_public_journal_comment_reactions(uuid) to anon, authenticated;

create or replace function public.set_public_journal_comment_reaction(
  p_share_token uuid,
  p_comment_id uuid,
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
    select 1 from public.journal_post_comments c
    join public.voyage_journal_posts p on p.id = c.post_id
    join public.voyages v on v.id = p.voyage_id
    where c.id = p_comment_id and v.journal_share_token is not null and v.journal_share_token = p_share_token
  ) then
    raise exception 'Commentaire introuvable pour ce lien de partage';
  end if;

  insert into public.journal_comment_reactions (comment_id, visitor_name, emoji, is_owner)
  values (p_comment_id, trim(p_visitor_name), p_emoji, false)
  on conflict (comment_id, visitor_name)
  do update set emoji = excluded.emoji, created_at = now();
end;
$$;

grant execute on function public.set_public_journal_comment_reaction(uuid, uuid, text, text) to anon, authenticated;

create or replace function public.remove_public_journal_comment_reaction(
  p_share_token uuid,
  p_comment_id uuid,
  p_visitor_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.journal_comment_reactions r
  using public.journal_post_comments c, public.voyage_journal_posts p, public.voyages v
  where r.comment_id = c.id
    and c.post_id = p.id
    and p.voyage_id = v.id
    and r.comment_id = p_comment_id
    and r.visitor_name = trim(p_visitor_name)
    and v.journal_share_token is not null
    and v.journal_share_token = p_share_token;
end;
$$;

grant execute on function public.remove_public_journal_comment_reaction(uuid, uuid, text) to anon, authenticated;
