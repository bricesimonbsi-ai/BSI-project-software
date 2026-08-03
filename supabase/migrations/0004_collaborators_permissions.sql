-- Politiques RLS pour project_collaborators (table créée dans 0003).
-- Invitation par email : si l'email n'a pas encore de compte, user_id reste
-- null et le trigger handle_new_user (0001) le rattache à l'inscription.

alter table public.project_collaborators enable row level security;

create policy "collaborators_select_access"
  on public.project_collaborators for select
  using (
    public.has_project_access(project_id, auth.uid(), false)
    or user_id = auth.uid()
  );

create policy "collaborators_write_project_owner_or_admin"
  on public.project_collaborators for all
  using (
    public.is_admin(auth.uid())
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  )
  with check (
    public.is_admin(auth.uid())
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );
