-- Marque un article de matériel comme déjà possédé (pas besoin de l'acheter) : dans ce cas,
-- pas de coût à prévoir et pas de tâche automatique "Prévoir : ..." — cocher l'article sert
-- alors uniquement de pense-bête ("à emporter"). Décocher "possédé" (ou le régler à faux) fait
-- réapparaître le coût et recrée la tâche. Migration additive.

alter table public.voyage_equipment add column if not exists owned boolean not null default false;

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
    if not new.owned then
      insert into public.todos (project_id, title, category, auto_generated, source_equipment_id, created_by)
      values (public.voyage_project_id(new.voyage_id), v_title, 'materiel', true, new.id, new.created_by);
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.owned then
      delete from public.todos where source_equipment_id = new.id;
    elsif exists (select 1 from public.todos where source_equipment_id = new.id) then
      update public.todos set title = v_title
        where source_equipment_id = new.id and title is distinct from v_title;
    else
      insert into public.todos (project_id, title, category, auto_generated, source_equipment_id, created_by)
      values (public.voyage_project_id(new.voyage_id), v_title, 'materiel', true, new.id, new.created_by);
    end if;
  end if;
  return new;
end;
$$;
