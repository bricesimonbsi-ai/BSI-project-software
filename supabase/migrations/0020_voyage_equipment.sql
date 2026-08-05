-- Liste de matériel à cocher par voyage (quantité ajustable), avec tâche automatique liée à
-- chaque article coché — sur le même modèle que les tâches auto visa/vaccin/permis déjà en
-- place. Le catalogue de base (~370 articles) est une donnée statique côté client (voir
-- equipment-catalog.ts), pas une table : cette table ne stocke que ce que l'utilisateur a
-- réellement coché pour CE voyage (un article non coché n'a simplement pas de ligne). Migration
-- additive.

create table if not exists public.voyage_equipment (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  category text not null,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voyage_id, category, name)
);

alter table public.voyage_equipment enable row level security;

create policy "voyage_equipment_select_access"
  on public.voyage_equipment for select
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), false));

create policy "voyage_equipment_write_access"
  on public.voyage_equipment for all
  using (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true))
  with check (public.has_project_access(public.voyage_project_id(voyage_id), auth.uid(), true));

alter table public.todos
  add column if not exists source_equipment_id uuid references public.voyage_equipment(id) on delete cascade;

-- Cocher un article crée automatiquement une tâche "Prévoir : ..." (catégorie matériel) ;
-- décocher (= supprimer la ligne) supprime la tâche via le ON DELETE CASCADE ci-dessus ; changer
-- la quantité met à jour le libellé de la tâche existante.
create or replace function public.sync_equipment_todo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  v_title := 'Prévoir : ' || new.name || case when new.quantity > 1 then ' (x' || new.quantity || ')' else '' end;
  if TG_OP = 'INSERT' then
    insert into public.todos (project_id, title, category, auto_generated, source_equipment_id, created_by)
    values (public.voyage_project_id(new.voyage_id), v_title, 'materiel', true, new.id, new.created_by);
  elsif TG_OP = 'UPDATE' then
    update public.todos set title = v_title
      where source_equipment_id = new.id and title is distinct from v_title;
  end if;
  return new;
end;
$$;

drop trigger if exists voyage_equipment_todo_sync on public.voyage_equipment;
create trigger voyage_equipment_todo_sync
  after insert or update on public.voyage_equipment
  for each row execute function public.sync_equipment_todo();
