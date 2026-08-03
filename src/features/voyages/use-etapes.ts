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

/** Insère un nouveau pays/région à une position précise (bouton "+" entre deux bandeaux pays). */
export function useInsertEtapeAt(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ atIndex, country_region }: { atIndex: number; country_region: string }) => {
      const { data: existing, error: fetchError } = await supabase
        .from("voyage_etapes")
        .select("id, order_index")
        .eq("voyage_id", voyageId)
        .gte("order_index", atIndex)
        .order("order_index", { ascending: true });
      if (fetchError) throw fetchError;

      await Promise.all(
        (existing ?? []).map((row) =>
          supabase
            .from("voyage_etapes")
            .update({ order_index: row.order_index + 1 })
            .eq("id", row.id)
            .then(({ error }) => {
              if (error) throw error;
            })
        )
      );

      const { error: insertError } = await supabase
        .from("voyage_etapes")
        .insert({ voyage_id: voyageId, country_region, order_index: atIndex });
      if (insertError) throw insertError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etapes", voyageId] }),
  });
}

/** Réordonne les pays d'un voyage (glisser-déposer) : réattribue order_index 0..N-1 dans l'ordre fourni. */
export function useReorderEtapes(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from("voyage_etapes").update({ order_index: index }).eq("id", id).then(({ error }) => {
            if (error) throw error;
          })
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["etapes", voyageId] }),
  });
}
