-- Active Supabase Realtime sur les tables consultées en direct par l'UI
-- (liste de notifications in-app, todos partagés). Bloc idempotent au cas où
-- la migration serait rejouée.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ) then
    alter publication supabase_realtime add table public.todos;
  end if;
end $$;
