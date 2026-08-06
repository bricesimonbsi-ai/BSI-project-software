-- Budget cible par voyageur : jusqu'ici un seul montant partagé (voyages.budget_target_per_person,
-- appliqué uniformément à tout le monde). Chaque voyageur doit pouvoir avoir sa propre cible
-- (rattachée au lien personne <-> projet, pas à la personne elle-même, puisqu'une même personne
-- peut avoir une cible différente selon le voyage). Migration additive : nullable pour ne rien
-- casser sur les liens déjà existants, le caractère "obligatoire" est porté par l'interface (qui
-- signale visuellement une cible manquante), pas par une contrainte NOT NULL qui bloquerait
-- l'application avant que l'utilisateur n'ait eu l'occasion de la renseigner.

alter table public.project_people
  add column if not exists budget_target numeric(12,2);
