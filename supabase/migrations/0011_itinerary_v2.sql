-- Itération 2 : refonte de l'itinéraire (vues multiples, tâches auto).
-- Migration strictement additive : aucune colonne supprimée/renommée, aucune
-- table recréée. Les voyages déjà saisis restent lisibles et inchangés.

-- Coordonnées GPS pour la carte (niveau pays sur l'étape, niveau ville sur la
-- sous-étape) + climat mensuel saisi manuellement (pas de source météo auto).
alter table public.voyage_etapes
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists climate_by_month jsonb;

alter table public.voyage_sous_etapes
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists distance_km numeric(10,2);

-- Tâches : catégorie libre + marquage "auto-générée" + rattachement à l'étape
-- source pour suppression en cascade si l'étape est supprimée.
alter table public.todos
  add column if not exists category text,
  add column if not exists auto_generated boolean not null default false,
  add column if not exists source_etape_id uuid references public.voyage_etapes(id) on delete cascade;

-- Une seule tâche "permis international" par voyage, même si plusieurs étapes
-- le nécessitent (contrainte d'unicité sur un identifiant dédié stocké dans le payload).
alter table public.todos
  add column if not exists dedup_key text;

create unique index if not exists todos_dedup_key_unique
  on public.todos (dedup_key)
  where dedup_key is not null;

-- Tâches automatiques liées au cycle de vie d'une étape (visa / vaccins / permis).

create or replace function public.sync_etape_auto_todos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_voyage_id uuid;
  v_creator uuid;
  v_permit_key text;
  v_permit_needed_elsewhere boolean;
begin
  v_voyage_id := coalesce(new.voyage_id, old.voyage_id);
  v_project_id := public.voyage_project_id(v_voyage_id);

  select created_by into v_creator from public.projects where id = v_project_id;

  -- Visa (par étape, supprimée automatiquement si l'étape est supprimée via cascade FK).
  if tg_op in ('INSERT', 'UPDATE') then
    if new.visa_needed then
      insert into public.todos (project_id, title, category, auto_generated, source_etape_id, created_by)
      select v_project_id, 'Visa pour ' || new.country_region, 'visa', true, new.id, v_creator
      where not exists (
        select 1 from public.todos where source_etape_id = new.id and category = 'visa'
      );
    else
      delete from public.todos where source_etape_id = new.id and category = 'visa';
    end if;

    if new.vaccines is not null and length(trim(new.vaccines)) > 0 then
      insert into public.todos (project_id, title, category, auto_generated, source_etape_id, created_by)
      select v_project_id, 'Vaccins (' || new.vaccines || ') pour ' || new.country_region, 'vaccin', true, new.id, v_creator
      where not exists (
        select 1 from public.todos where source_etape_id = new.id and category = 'vaccin'
      );
    else
      delete from public.todos where source_etape_id = new.id and category = 'vaccin';
    end if;
  end if;

  -- Permis international : une seule tâche par voyage (dédupliquée via dedup_key).
  -- Un trigger AFTER voit déjà l'état post-modification de la table (y compris sa
  -- propre ligne insérée/modifiée, ou l'absence de la ligne supprimée), donc un
  -- simple comptage sur l'état courant suffit à savoir si le permis est encore requis.
  v_permit_key := 'intl_permit:' || v_voyage_id::text;

  select exists(
    select 1 from public.voyage_etapes e
    where e.voyage_id = v_voyage_id and e.intl_permit_needed
  ) into v_permit_needed_elsewhere;

  if v_permit_needed_elsewhere then
    insert into public.todos (project_id, title, category, auto_generated, dedup_key, created_by)
    select v_project_id, 'Permis de conduire international', 'permis', true, v_permit_key, v_creator
    where not exists (select 1 from public.todos where dedup_key = v_permit_key);
  else
    delete from public.todos where dedup_key = v_permit_key;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_etape_change_sync_todos on public.voyage_etapes;
create trigger on_etape_change_sync_todos
  after insert or update or delete on public.voyage_etapes
  for each row execute function public.sync_etape_auto_todos();
