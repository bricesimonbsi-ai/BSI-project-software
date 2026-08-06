import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { Permission, ProjectCollaborator } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useCollaborators(projectId: string) {
  return useQuery({
    queryKey: ["collaborators", projectId],
    queryFn: async (): Promise<ProjectCollaborator[]> => {
      const { data, error } = await supabase.from("project_collaborators").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddCollaborator(projectId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { email: string; permission: Permission }) => {
      if (!session) throw new Error("Non authentifié");
      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        email: input.email.toLowerCase().trim(),
        permission: input.permission,
        invited_by: session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collaborators", projectId] }),
    onError: onMutationError,
  });
}

export function useRemoveCollaborator(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collaborators", projectId] }),
    onError: onMutationError,
  });
}
