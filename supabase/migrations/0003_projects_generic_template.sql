-- Gabarit de projet générique : utilisé par toute catégorie sans module dédié.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null,
  description text,
  start_date date,
  end_date date,
  budget_planned numeric(14,2),
  budget_actual numeric(14,2),
  currency text not null default 'EUR',
  status text not null default 'active' check (status in ('active', 'upcoming', 'completed', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Table créée ici (avant les politiques RLS qui la référencent) ; ses propres
-- politiques et le trigger de rattachement d'invitation sont dans 0004.
create table if not exists public.project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  permission text not null default 'read' check (permission in ('read', 'write')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

create or replace function public.has_project_access(pid uuid, uid uuid, require_write boolean default false)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin(uid)
    or exists (
      select 1 from public.projects p where p.id = pid and p.created_by = uid
    )
    or exists (
      select 1 from public.project_collaborators pc
      where pc.project_id = pid
        and pc.user_id = uid
        and (not require_write or pc.permission = 'write')
    );
$$;

create policy "projects_select_access"
  on public.projects for select
  using (public.has_project_access(id, auth.uid(), false));

create policy "projects_insert_authenticated"
  on public.projects for insert
  with check (created_by = auth.uid());

create policy "projects_update_write_access"
  on public.projects for update
  using (public.has_project_access(id, auth.uid(), true));

create policy "projects_delete_write_access"
  on public.projects for delete
  using (public.has_project_access(id, auth.uid(), true));
