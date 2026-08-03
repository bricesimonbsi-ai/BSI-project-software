import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import type { DocumentRow } from "@/types/database";

const BUCKET = "project-documents";

export function useDocuments(projectId: string, voyageEtapeId?: string) {
  return useQuery({
    queryKey: ["documents", projectId, voyageEtapeId ?? "project"],
    queryFn: async (): Promise<DocumentRow[]> => {
      let query = supabase.from("documents").select("*").eq("project_id", projectId);
      query = voyageEtapeId ? query.eq("voyage_etape_id", voyageEtapeId) : query.is("voyage_etape_id", null);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUploadDocument(projectId: string, voyageEtapeId?: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!session) throw new Error("Non authentifié");
      const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("documents").insert({
        project_id: projectId,
        voyage_etape_id: voyageEtapeId ?? null,
        storage_path: path,
        name: file.name,
        size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", projectId] }),
  });
}

export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", projectId] }),
  });
}

export async function getDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
