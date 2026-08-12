import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { Project, MediaType } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export type ProjectWithCategory = Project & {
  categories: { name: string; color: string; icon: string | null; module_key: string | null } | null;
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectWithCategory[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, categories(name, color, icon, module_key)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectWithCategory[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectWithCategory> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, categories(name, color, icon, module_key)")
        .eq("id", projectId as string)
        .single();
      if (error) throw error;
      return data as unknown as ProjectWithCategory;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      category_id: string;
      title: string;
      icon?: string | null;
      description?: string;
      start_date?: string | null;
      end_date?: string | null;
      budget_planned?: number | null;
      currency?: string;
      media_type?: MediaType | null;
    }) => {
      if (!session) throw new Error("Non authentifié");
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...input, created_by: session.user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onError: onMutationError,
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", variables.id] });
    },
    onError: onMutationError,
  });
}

/** Supprime un projet (voyage compris) et tout ce qui s'y rattache : le schéma cascade déjà
 * proprement depuis `projects` (voyages, étapes, sous-étapes, dépenses, équipement, tâches,
 * documents, collaborateurs) via ON DELETE CASCADE, une seule suppression suffit donc. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onError: onMutationError,
  });
}
