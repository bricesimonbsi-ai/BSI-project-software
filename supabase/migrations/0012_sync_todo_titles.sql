-- Corrige sync_etape_auto_todos : le titre des tâches auto (visa/vaccin) restait figé sur
-- l'ancien nom du pays (ou l'ancien texte des vaccins) après renommage, car seuls la
-- création (si absente) et la suppression (si le besoin est décoché) étaient gérées.
-- Migration additive : remplace uniquement le corps de la fonction, aucune donnée touchée.

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
      if exists (select 1 from public.todos where source_etape_id = new.id and category = 'visa') then
        update public.todos set title = 'Visa pour ' || new.country_region
          where source_etape_id = new.id and category = 'visa';
      else
        insert into public.todos (project_id, title, category, auto_generated, source_etape_id, created_by)
        values (v_project_id, 'Visa pour ' || new.country_region, 'visa', true, new.id, v_creator);
      end if;
    else
      delete from public.todos where source_etape_id = new.id and category = 'visa';
    end if;

    if new.vaccines is not null and length(trim(new.vaccines)) > 0 then
      if exists (select 1 from public.todos where source_etape_id = new.id and category = 'vaccin') then
        update public.todos set title = 'Vaccins (' || new.vaccines || ') pour ' || new.country_region
          where source_etape_id = new.id and category = 'vaccin';
      else
        insert into public.todos (project_id, title, category, auto_generated, source_etape_id, created_by)
        values (v_project_id, 'Vaccins (' || new.vaccines || ') pour ' || new.country_region, 'vaccin', true, new.id, v_creator);
      end if;
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
