-- 1) Préférences de notification granulaires : par type de notification et par projet. Aucune
-- ligne pour une combinaison (user, type, projet) = notification active (comportement actuel
-- inchangé par défaut) ; une ligne enabled=false la désactive explicitement. Gérable en libre-
-- service dans Réglages, sans avoir à le demander.

create table if not exists public.notification_type_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type, project_id)
);

alter table public.notification_type_preferences enable row level security;

create policy "notification_type_preferences_own"
  on public.notification_type_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.notify_todo_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null
     and new.assignee_id <> new.created_by
     and (tg_op = 'INSERT' or old.assignee_id is distinct from new.assignee_id) then
    if new.project_id is null or not exists (
      select 1 from public.notification_type_preferences
      where user_id = new.assignee_id
        and notification_type = 'todo_assigned'
        and project_id = new.project_id
        and enabled = false
    ) then
      insert into public.notifications (user_id, type, title, body, payload)
      values (
        new.assignee_id,
        'todo_assigned',
        'Nouvelle tâche assignée',
        new.title,
        jsonb_build_object('todo_id', new.id, 'project_id', new.project_id)
      );
    end if;
  end if;
  return new;
end;
$$;

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

  if v_author_id is not null and not exists (
    select 1 from public.notification_type_preferences
    where user_id = v_author_id
      and notification_type = 'journal_reaction'
      and project_id = v_project_id
      and enabled = false
  ) then
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

  if v_author_id is not null and not exists (
    select 1 from public.notification_type_preferences
    where user_id = v_author_id
      and notification_type = 'journal_comment'
      and project_id = v_project_id
      and enabled = false
  ) then
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

-- 2) Partage public de la synthèse média (notes/commentaires personnels) — même principe que le
-- lien de partage du journal (voyages.journal_share_token) : présence d'un token = partage actif.
-- Mise à jour déjà couverte par la policy d'écriture existante de "projects", aucune policy
-- supplémentaire nécessaire pour cette colonne.

alter table public.projects add column if not exists media_share_token uuid;

create unique index if not exists projects_media_share_token_idx
  on public.projects (media_share_token)
  where media_share_token is not null;

create or replace function public.get_public_media_meta(p_share_token uuid)
returns table (
  project_id uuid,
  title text,
  icon text,
  media_type text
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.title, p.icon, p.media_type
  from public.projects p
  where p.media_share_token is not null and p.media_share_token = p_share_token;
$$;

grant execute on function public.get_public_media_meta(uuid) to anon, authenticated;

-- Un contenu par ligne (uniquement ceux notés par au moins une personne — c'est une synthèse de
-- recommandations, pas un catalogue complet), avec le détail de chaque note/commentaire par
-- personne agrégé en JSON, trié par note moyenne décroissante.
create or replace function public.get_public_media_synthesis(p_share_token uuid)
returns table (
  item_id uuid,
  title text,
  poster_path text,
  media_type text,
  release_date date,
  external_rating numeric,
  avg_rating numeric,
  ratings jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    m.id,
    m.title,
    m.poster_path,
    m.type,
    m.release_date,
    m.external_rating,
    avg(r.rating),
    jsonb_agg(
      jsonb_build_object('person_name', pe.name, 'rating', r.rating, 'comment', r.comment)
      order by r.rating desc
    )
  from public.media_items m
  join public.projects p on p.id = m.project_id
  join public.media_item_ratings r on r.media_item_id = m.id
  join public.people pe on pe.id = r.person_id
  where p.media_share_token is not null and p.media_share_token = p_share_token
  group by m.id, m.title, m.poster_path, m.type, m.release_date, m.external_rating
  order by avg(r.rating) desc;
$$;

grant execute on function public.get_public_media_synthesis(uuid) to anon, authenticated;
