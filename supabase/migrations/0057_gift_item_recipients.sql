-- Permet d'associer PLUSIEURS personnes à une même idée de cadeau (cadeau commun, ex. "pour Papa
-- et Maman") au lieu d'un seul champ person_id/person_name — chaque destinataire est une ligne à
-- part, liée au répertoire "Personnes" (person_id) ou en nom libre (name), jamais les deux à la
-- fois, pour viser quelqu'un sans l'ajouter au répertoire.
create table if not exists public.gift_item_recipients (
  id uuid primary key default gen_random_uuid(),
  gift_item_id uuid not null references public.gift_items(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  name text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint gift_item_recipients_person_xor_name check ((person_id is not null) <> (name is not null))
);

alter table public.gift_item_recipients enable row level security;

create policy "gift_item_recipients_select_access"
  on public.gift_item_recipients for select
  using (
    exists (
      select 1 from public.gift_items g
      where g.id = gift_item_id and public.has_project_access(g.project_id, auth.uid(), false)
    )
  );

create policy "gift_item_recipients_write_access"
  on public.gift_item_recipients for all
  using (
    exists (
      select 1 from public.gift_items g
      where g.id = gift_item_id and public.has_project_access(g.project_id, auth.uid(), true)
    )
  )
  with check (
    exists (
      select 1 from public.gift_items g
      where g.id = gift_item_id and public.has_project_access(g.project_id, auth.uid(), true)
    )
  );

-- Reprend les destinataires déjà saisis (un par idée) en première ligne de la nouvelle table.
insert into public.gift_item_recipients (gift_item_id, person_id, name, position)
select id, person_id, person_name, 0
from public.gift_items
where person_id is not null or person_name is not null;

alter table public.gift_items drop column if exists person_id;
alter table public.gift_items drop column if exists person_name;
