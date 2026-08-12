-- Notifie l'auteur d'une publication du journal quand un visiteur y réagit ou la commente — sur
-- le modèle de notify_todo_assignment (0009) : un trigger SECURITY DEFINER, car l'insertion en
-- journal_post_reactions/journal_post_comments vient le plus souvent d'un visiteur anonyme (rôle
-- anon, via les RPC de 0039) qui n'a bien sûr aucun droit d'écriture direct sur "notifications".

create or replace function public.notify_journal_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_city text;
begin
  select p.author_id, se.city into v_author_id, v_city
  from public.voyage_journal_posts p
  left join public.voyage_sous_etapes se on se.id = p.sous_etape_id
  where p.id = new.post_id;

  if v_author_id is not null then
    insert into public.notifications (user_id, type, title, body, payload)
    values (
      v_author_id,
      'journal_reaction',
      'Nouvelle réaction sur votre journal',
      new.visitor_name || ' a réagi ' || new.emoji || coalesce(' (' || v_city || ')', ''),
      jsonb_build_object('post_id', new.post_id, 'emoji', new.emoji, 'visitor_name', new.visitor_name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_journal_reaction on public.journal_post_reactions;
create trigger on_journal_reaction
  after insert or update on public.journal_post_reactions
  for each row execute function public.notify_journal_reaction();

create or replace function public.notify_journal_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  -- Une réponse de l'auteur lui-même (is_owner_reply) ne se notifie pas à lui-même.
  if new.is_owner_reply then
    return new;
  end if;

  select author_id into v_author_id from public.voyage_journal_posts where id = new.post_id;

  if v_author_id is not null then
    insert into public.notifications (user_id, type, title, body, payload)
    values (
      v_author_id,
      'journal_comment',
      'Nouveau commentaire sur votre journal',
      new.author_name || ' : ' || left(new.content, 140),
      jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'visitor_name', new.author_name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_journal_comment on public.journal_post_comments;
create trigger on_journal_comment
  after insert on public.journal_post_comments
  for each row execute function public.notify_journal_comment();
