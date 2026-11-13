-- Simplifie une idée de cadeau à l'essentiel (titre, destinataire, lien) : prix estimé et notes
-- retirés, pas assez utilisés pour justifier la place qu'ils prenaient dans la liste.
alter table public.gift_items drop column if exists price_estimate;
alter table public.gift_items drop column if exists notes;
