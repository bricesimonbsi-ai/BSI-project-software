import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { Person, ProjectPerson } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

/** Liste globale des personnes du compte (paramétrable, réutilisable sur tous les projets). */
export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.from("people").select("*").order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; avatar_emoji: string | null; order_index: number }) => {
      if (!session) throw new Error("Non authentifié");
      const { data, error } = await supabase
        .from("people")
        .insert({ ...input, created_by: session.user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as Person;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["people"] }),
    onError: onMutationError,
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Pick<Person, "name" | "avatar_emoji" | "avatar_config">> & { id: string }) => {
      const { error } = await supabase.from("people").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["project-people"] });
    },
    onError: onMutationError,
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["project-people"] });
    },
    onError: onMutationError,
  });
}

export type ProjectPersonRow = ProjectPerson & { people: Person };

/** Personnes associées à un projet donné (ex. les voyageurs d'un voyage). */
export function useProjectPeople(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-people", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectPersonRow[]> => {
      const { data, error } = await supabase
        .from("project_people")
        .select("*, people(*)")
        .eq("project_id", projectId as string);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectPersonRow[];
    },
  });
}

export function useAddPersonToProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (personId: string) => {
      const { error } = await supabase.from("project_people").insert({ project_id: projectId, person_id: personId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-people", projectId] }),
    onError: onMutationError,
  });
}

/** Budget cible d'un voyageur pour ce projet précis (rattaché au lien personne <-> projet, voir
 * ProjectPerson.budget_target) — jamais à la personne elle-même. */
export function useUpdateProjectPersonBudgetTarget(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, budget_target }: { id: string; budget_target: number | null }) => {
      const { error } = await supabase.from("project_people").update({ budget_target }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-people", projectId] }),
    onError: onMutationError,
  });
}

export function useRemovePersonFromProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectPersonId: string) => {
      const { error } = await supabase.from("project_people").delete().eq("id", projectPersonId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-people", projectId] }),
    onError: onMutationError,
  });
}
