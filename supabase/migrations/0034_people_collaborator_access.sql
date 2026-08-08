-- Corrige un accès manquant : la politique RLS "people_select_access" (0016) ne laissait lire une
-- personne qu'à celui qui l'a créée (created_by = auth.uid()). Un collaborateur simplement invité
-- sur un projet (pas créateur) ne pouvait donc jamais voir les voyageurs qui lui sont pourtant
-- rattachés — la jointure "project_people(*, people(*))" revenait avec people = null côté client,
-- ce qui faisait planter l'affichage (accès à .name sur null) partout où les voyageurs sont
-- montrés : accueil (projet en avant), dépenses, budget, sélecteur de personnes.
-- Politique additionnelle (les politiques SELECT se cumulent en OR) : accès en lecture si la
-- personne est rattachée à au moins un projet auquel l'utilisateur courant a accès.
create policy "people_select_via_project_access"
  on public.people for select
  using (
    exists (
      select 1
      from public.project_people pp
      where pp.person_id = people.id
        and public.has_project_access(pp.project_id, auth.uid(), false)
    )
  );
