import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { ProjectCollaborator, Permission } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export type MyManageableProject = { id: string; title: string; icon: string | null };

/** Projets dont je suis le créateur — seuls ceux-là peuvent avoir leurs collaborateurs gérés
 * (même règle que collaborators_write_project_owner_or_admin, 0004_collaborators_permissions.sql :
 * seul le créateur, pas un collaborateur "write", gère qui a accès). */
export function useMyOwnedProjects() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-owned-projects", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<MyManageableProject[]> => {
      const { data, error } = await supabase.from("projects").select("id, title, icon").eq("created_by", session!.user.id).order("title");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ProjectCollaboratorWithProject = ProjectCollaborator & { projectTitle: string; projectIcon: string | null };

/** Tous les collaborateurs de tous mes projets en une seule requête — alimente la page
 * d'administration centralisée des accès (au lieu de devoir ouvrir chaque projet). */
export function useAllProjectCollaborators() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["all-project-collaborators", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<ProjectCollaboratorWithProject[]> => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("*, projects!inner(title, icon, created_by)")
        .eq("projects.created_by", session!.user.id);
      if (error) throw error;
      return ((data ?? []) as unknown as (ProjectCollaborator & { projects: { title: string; icon: string | null } })[]).map((r) => ({
        ...r,
        projectTitle: r.projects.title,
        projectIcon: r.projects.icon,
      }));
    },
  });
}

export function useRemoveProjectCollaboratorGlobal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-project-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
    onError: onMutationError,
  });
}

export function useUpdateProjectCollaboratorPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permission }: { id: string; permission: Permission }) => {
      const { error } = await supabase.from("project_collaborators").update({ permission }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-project-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
    onError: onMutationError,
  });
}
