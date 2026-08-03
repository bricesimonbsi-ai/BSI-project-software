import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { VoyageEtape } from "@/types/database";

export function useEtapes(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["etapes", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageEtape[]> => {
      const { data, error } = await supabase
        .from("voyage_etapes")
        .select("*")
        .eq("voyage_id", voyageId as string)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateEtape(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<VoyageEtape> & { country_region: string; order_index: number }) => {
      const { error } = await supabase.from("voyage_etapes").insert({ ...input, voyage_id: voyageId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etapes", voyageId] }),
  });
}

export function useUpdateEtape(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VoyageEtape> & { id: string }) => {
      const { error } = await supabase.from("voyage_etapes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etapes", voyageId] }),
  });
}

export function useDeleteEtape(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voyage_etapes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etapes", voyageId] }),
  });
}
