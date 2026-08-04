import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { VoyageTraveler } from "@/types/database";

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, voyageId: string) {
  queryClient.invalidateQueries({ queryKey: ["voyage-travelers", voyageId] });
  queryClient.invalidateQueries({ queryKey: ["voyage-traveler-expense-summary", voyageId] });
}

export function useTravelers(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-travelers", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageTraveler[]> => {
      const { data, error } = await supabase
        .from("voyage_travelers")
        .select("*")
        .eq("voyage_id", voyageId as string)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTraveler(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; avatar_emoji: string | null; order_index: number }) => {
      const { error } = await supabase.from("voyage_travelers").insert({ ...input, voyage_id: voyageId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(queryClient, voyageId),
  });
}

export function useUpdateTraveler(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VoyageTraveler> & { id: string }) => {
      const { error } = await supabase.from("voyage_travelers").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(queryClient, voyageId),
  });
}

export function useDeleteTraveler(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voyage_travelers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(queryClient, voyageId),
  });
}
