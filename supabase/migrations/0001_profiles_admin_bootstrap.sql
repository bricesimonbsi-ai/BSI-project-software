-- Profils applicatifs liés aux utilisateurs Supabase Auth.
-- Le premier utilisateur inscrit devient automatiquement administrateur
-- (pas de clé service_role disponible pour promouvoir un utilisateur autrement en V1).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_exists boolean;
begin
  select exists(select 1 from public.profiles where is_admin) into admin_exists;

  insert into public.profiles (id, email, display_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    not admin_exists
  );

  -- Rattache les invitations de collaboration en attente correspondant à cet email.
  update public.project_collaborators
  set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);

  return new;
exception when undefined_table then
  -- project_collaborators n'existe pas encore lors de la toute première migration ; ignorer.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin(auth.uid()));

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin(auth.uid()));
