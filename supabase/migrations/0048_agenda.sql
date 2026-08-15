-- Agenda partageable : événements libres (titre, date/heure, lieu, description), participants
-- issus du répertoire "Personnes" existant, partagé avec des collaborateurs en écriture. Premier
-- mécanisme de partage transverse (au niveau du compte, pas d'un projet) de ce schéma — construit
-- en miroir de project_collaborators/has_project_access (0003/0004), avec owner_id à la place de
-- project_id. Les "Tâches transverses" existantes (todos sans project_id) ne sont PAS partagées
-- entre comptes (visibles seulement par leur créateur, cf. RLS de 0005_todos.sql) : ce n'était
-- donc pas un pattern réutilisable tel quel pour un agenda réellement partagé en écriture.

create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.agenda_events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  unique (event_id, person_id)
);

-- Colonnes identiques à project_collaborators (0003), owner_id à la place de project_id.
create table if not exists public.agenda_collaborators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  permission text not null default 'write' check (permission in ('read', 'write')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);

-- Miroir exact de has_project_access (0003) : oid = uid remplace le test "created_by = uid" des
-- projets, puisqu'un agenda n'a pas de ligne "projects" propriétaire — l'owner est la personne
-- elle-même.
create or replace function public.has_agenda_access(oid uuid, uid uuid, require_write boolean default false)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin(uid)
    or oid = uid
    or exists (
      select 1 from public.agenda_collaborators ac
      where ac.owner_id = oid
        and ac.user_id = uid
        and (not require_write or ac.permission = 'write')
    );
$$;

-- people (répertoire "Personnes", 0016) n'est lisible que par son créateur, avec un accès
-- additionnel déjà accordé via les projets partagés (0034_people_collaborator_access.sql) — mais
-- un agenda n'est pas un projet, donc sans cette policy un collaborateur d'agenda ne verrait
-- jamais les personnes de l'agenda partagé (sélecteur de participants vide, puces de couleur
-- manquantes). Même principe additif que 0034, via has_agenda_access à la place de
-- has_project_access.
create policy "people_select_via_agenda_access"
  on public.people for select
  using (public.has_agenda_access(people.created_by, auth.uid(), false));

-- profiles n'est lisible que par soi-même (profiles_select_self_or_admin, 0001) : sans cette
-- policy additive, un collaborateur ne pourrait jamais lire le nom/email de la personne dont il
-- partage l'agenda (le sélecteur "Agenda de {nom}" resterait vide). Additive uniquement : les
-- policies RLS se combinent en OR, celle-ci ne retire aucun accès existant.
create policy "profiles_select_agenda_owner"
  on public.profiles for select
  using (
    exists (
      select 1 from public.agenda_collaborators ac
      where ac.owner_id = profiles.id and ac.user_id = auth.uid()
    )
  );

alter table public.agenda_events enable row level security;
alter table public.agenda_event_participants enable row level security;
alter table public.agenda_collaborators enable row level security;

create policy "agenda_events_select_access"
  on public.agenda_events for select
  using (public.has_agenda_access(owner_id, auth.uid(), false));

create policy "agenda_events_write_access"
  on public.agenda_events for all
  using (public.has_agenda_access(owner_id, auth.uid(), true))
  with check (public.has_agenda_access(owner_id, auth.uid(), true));

create policy "agenda_event_participants_select_access"
  on public.agenda_event_participants for select
  using (
    exists (
      select 1 from public.agenda_events e
      where e.id = event_id and public.has_agenda_access(e.owner_id, auth.uid(), false)
    )
  );

create policy "agenda_event_participants_write_access"
  on public.agenda_event_participants for all
  using (
    exists (
      select 1 from public.agenda_events e
      where e.id = event_id and public.has_agenda_access(e.owner_id, auth.uid(), true)
    )
  )
  with check (
    exists (
      select 1 from public.agenda_events e
      where e.id = event_id and public.has_agenda_access(e.owner_id, auth.uid(), true)
    )
  );

-- Comme collaborators_select_access/collaborators_write_project_owner_or_admin (0004) : tout
-- collaborateur (même lecture) voit la liste, mais seul l'owner (ou un admin) gère qui en fait
-- partie — pas les collaborateurs "write", cohérent avec le comportement des projets.
create policy "agenda_collaborators_select_access"
  on public.agenda_collaborators for select
  using (public.has_agenda_access(owner_id, auth.uid(), false) or user_id = auth.uid());

create policy "agenda_collaborators_write_owner_or_admin"
  on public.agenda_collaborators for all
  using (public.is_admin(auth.uid()) or owner_id = auth.uid())
  with check (public.is_admin(auth.uid()) or owner_id = auth.uid());

-- Étend handle_new_user (0001) pour rattacher aussi les invitations d'agenda en attente à la
-- création de compte (même principe que pour project_collaborators, ligne 44-47 de 0001).
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

  update public.project_collaborators
  set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);

  update public.agenda_collaborators
  set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);

  return new;
exception when undefined_table then
  return new;
end;
$$;
