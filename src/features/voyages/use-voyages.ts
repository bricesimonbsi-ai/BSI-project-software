import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Voyage } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useVoyage(projectId: string | undefined) {
  return useQuery({
    queryKey: ["voyage", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Voyage> => {
      const { data, error } = await supabase.from("voyages").select("*").eq("project_id", projectId as string).single();
      if (error) throw error;
      return data as Voyage;
    },
  });
}

export function useUpdateVoyage(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Voyage>) => {
      const { error } = await supabase.from("voyages").update(updates).eq("project_id", projectId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voyage", projectId] }),
    onError: onMutationError,
  });
}
