import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import type { Project } from "@/types/database";

export type ProjectWithCategory = Project & {
  categories: { name: string; color: string; module_key: string | null } | null;
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectWithCategory[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, categories(name, color, module_key)")
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
        .select("*, categories(name, color, module_key)")
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
      description?: string;
      start_date?: string | null;
      end_date?: string | null;
      budget_planned?: number | null;
      currency?: string;
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
  });
}
