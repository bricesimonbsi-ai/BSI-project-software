import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { VoyageSousEtape } from "@/types/database";

export function useSousEtapes(etapeId: string | undefined) {
  return useQuery({
    queryKey: ["sous-etapes", etapeId],
    enabled: !!etapeId,
    queryFn: async (): Promise<VoyageSousEtape[]> => {
      const { data, error } = await supabase
        .from("voyage_sous_etapes")
        .select("*")
        .eq("etape_id", etapeId as string)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSousEtape(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<VoyageSousEtape> & { city: string; order_index: number }) => {
      const { error } = await supabase.from("voyage_sous_etapes").insert({ ...input, etape_id: etapeId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sous-etapes", etapeId] }),
  });
}

export function useUpdateSousEtape(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VoyageSousEtape> & { id: string }) => {
      const { error } = await supabase.from("voyage_sous_etapes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sous-etapes", etapeId] }),
  });
}

export function useDeleteSousEtape(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voyage_sous_etapes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sous-etapes", etapeId] }),
  });
}
