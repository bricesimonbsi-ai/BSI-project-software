-- Corrige sync_sous_etape_flight_todo : le titre ne précisait que la ville de départ.
-- Ajoute la ville de destination (la prochaine ville dans l'ordre global du voyage,
-- tous pays confondus — même logique que buildFlatRows côté application) quand elle
-- est connue. Migration additive : remplace uniquement le corps de la fonction.

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
  v_etape_order integer;
  v_next_city text;
  v_title text;
begin
  select e.voyage_id, e.order_index into v_voyage_id, v_etape_order
    from public.voyage_etapes e where e.id = new.etape_id;
  v_project_id := public.voyage_project_id(v_voyage_id);
  select created_by into v_creator from public.projects where id = v_project_id;

  if new.transport_next_mode is not null and lower(new.transport_next_mode) = 'avion' then
    -- Prochaine ville dans l'ordre global (pays puis villes) : toute ville dont le
    -- couple (ordre du pays, ordre de la ville) suit strictement celui de la ville
    -- courante, quel que soit son pays — traverse naturellement les pays sans ville.
    select se2.city into v_next_city
      from public.voyage_sous_etapes se2
      join public.voyage_etapes e2 on e2.id = se2.etape_id
      where e2.voyage_id = v_voyage_id
        and (e2.order_index, se2.order_index) > (v_etape_order, new.order_index)
      order by e2.order_index, se2.order_index
      limit 1;

    v_title := 'Réserver le vol depuis ' || new.city || coalesce(' pour ' || v_next_city, '');

    if exists (select 1 from public.todos where source_sous_etape_id = new.id and category = 'vol') then
      update public.todos set title = v_title
        where source_sous_etape_id = new.id and category = 'vol';
    else
      insert into public.todos (project_id, title, category, auto_generated, source_sous_etape_id, created_by)
      values (v_project_id, v_title, 'vol', true, new.id, v_creator);
    end if;
  else
    delete from public.todos where source_sous_etape_id = new.id and category = 'vol';
  end if;

  return new;
end;
$$;
