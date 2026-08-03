-- Todo list : rattachée à un projet, ou transverse (project_id null).

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "todos_select_access"
  on public.todos for select
  using (
    (project_id is not null and public.has_project_access(project_id, auth.uid(), false))
    or (project_id is null and created_by = auth.uid())
    or public.is_admin(auth.uid())
  );

create policy "todos_insert_access"
  on public.todos for insert
  with check (
    created_by = auth.uid()
    and (
      project_id is null
      or public.has_project_access(project_id, auth.uid(), true)
    )
  );

create policy "todos_update_access"
  on public.todos for update
  using (
    (project_id is not null and public.has_project_access(project_id, auth.uid(), true))
    or (project_id is null and created_by = auth.uid())
    or public.is_admin(auth.uid())
  );

create policy "todos_delete_access"
  on public.todos for delete
  using (
    (project_id is not null and public.has_project_access(project_id, auth.uid(), true))
    or (project_id is null and created_by = auth.uid())
    or public.is_admin(auth.uid())
  );
