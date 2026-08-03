-- Notifications in-app (liste + Realtime). L'envoi réel push/email est différé
-- à une itération ultérieure ; cette table prépare la structure.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid());

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_fallback_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_own"
  on public.notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Notifie l'assigné quand une todo lui est attribuée.
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
    insert into public.notifications (user_id, type, title, body, payload)
    values (
      new.assignee_id,
      'todo_assigned',
      'Nouvelle tâche assignée',
      new.title,
      jsonb_build_object('todo_id', new.id, 'project_id', new.project_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_todo_assignment on public.todos;
create trigger on_todo_assignment
  after insert or update on public.todos
  for each row execute function public.notify_todo_assignment();
