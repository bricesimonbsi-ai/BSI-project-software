-- Migration additive : tâche auto "réserver le vol" (mode de transport avion) +
-- climat mensuel au niveau ville (précision supérieure au niveau pays, optionnel :
-- une ville sans climat propre hérite de celui de son pays côté application).

alter table public.voyage_sous_etapes
  add column if not exists climate_by_month jsonb;

alter table public.todos
  add column if not exists source_sous_etape_id uuid references public.voyage_sous_etapes(id) on delete cascade;

-- Tâche automatique "réserver le vol" quand le transport vers l'étape suivante est en
-- avion : créée/mise à jour à l'insertion ou la modification, supprimée si le mode change
-- (sinon avion) ou si la sous-étape est supprimée (cascade FK via source_sous_etape_id).
create or replace function public.sync_sous_etape_flight_todo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_voyage_id uuid;
  v_creator uuid;
begin
  select e.voyage_id into v_voyage_id from public.voyage_etapes e where e.id = new.etape_id;
  v_project_id := public.voyage_project_id(v_voyage_id);
  select created_by into v_creator from public.projects where id = v_project_id;

  if new.transport_next_mode is not null and lower(new.transport_next_mode) = 'avion' then
    if exists (select 1 from public.todos where source_sous_etape_id = new.id and category = 'vol') then
      update public.todos set title = 'Réserver le vol depuis ' || new.city
        where source_sous_etape_id = new.id and category = 'vol';
    else
      insert into public.todos (project_id, title, category, auto_generated, source_sous_etape_id, created_by)
      values (v_project_id, 'Réserver le vol depuis ' || new.city, 'vol', true, new.id, v_creator);
    end if;
  else
    delete from public.todos where source_sous_etape_id = new.id and category = 'vol';
  end if;

  return new;
end;
$$;

drop trigger if exists on_sous_etape_change_sync_flight_todo on public.voyage_sous_etapes;
create trigger on_sous_etape_change_sync_flight_todo
  after insert or update on public.voyage_sous_etapes
  for each row execute function public.sync_sous_etape_flight_todo();
