-- Documents non sensibles (billets, réservations, plans) liés à un projet et,
-- optionnellement, à une étape de voyage. Pas de pièces d'identité.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  voyage_etape_id uuid references public.voyage_etapes(id) on delete set null,
  storage_path text not null,
  name text not null,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents_select_access"
  on public.documents for select
  using (public.has_project_access(project_id, auth.uid(), false));

create policy "documents_write_access"
  on public.documents for all
  using (public.has_project_access(project_id, auth.uid(), true))
  with check (public.has_project_access(project_id, auth.uid(), true));

-- Bucket de stockage privé pour les documents projet.
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- Chemin attendu : {project_id}/{filename} — permet de dériver l'accès du
-- premier segment du chemin sans dénormaliser dans storage.objects.
create policy "project_documents_select_access"
  on storage.objects for select
  using (
    bucket_id = 'project-documents'
    and public.has_project_access((storage.foldername(name))[1]::uuid, auth.uid(), false)
  );

create policy "project_documents_write_access"
  on storage.objects for insert
  with check (
    bucket_id = 'project-documents'
    and public.has_project_access((storage.foldername(name))[1]::uuid, auth.uid(), true)
  );

create policy "project_documents_delete_access"
  on storage.objects for delete
  using (
    bucket_id = 'project-documents'
    and public.has_project_access((storage.foldername(name))[1]::uuid, auth.uid(), true)
  );
