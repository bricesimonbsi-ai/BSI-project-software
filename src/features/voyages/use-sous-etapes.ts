import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { invalidateAllExpenseQueries } from "@/features/voyages/use-expenses";
import type { VoyageSousEtape } from "@/types/database";

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, etapeId: string) {
  queryClient.invalidateQueries({ queryKey: ["sous-etapes", etapeId] });
  queryClient.invalidateQueries({ queryKey: ["voyage-sous-etapes"] });
  // Le nombre de nuits/la ville pilotent les estimations prévisionnelles affichées ailleurs
  // (tableau budget, dialogue), et supprimer une ville cascade en base sur ses dépenses :
  // invalider ici évite tout décalage entre ce qui est affiché et l'état réel.
  invalidateAllExpenseQueries(queryClient);
}

/** Toutes les sous-étapes (villes) de tous les pays d'un voyage, en une requête. */
export function useVoyageSousEtapes(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-sous-etapes", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageSousEtape[]> => {
      const { data, error } = await supabase
        .from("voyage_sous_etapes")
        .select("*, voyage_etapes!inner(voyage_id)")
        .eq("voyage_etapes.voyage_id", voyageId as string)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as VoyageSousEtape[];
    },
  });
}

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
    onSuccess: () => invalidateAll(queryClient, etapeId),
  });
}

/**
 * Insère une ville à une position précise (bouton "+" entre deux lignes) :
 * décale les order_index existants >= la position cible, puis insère la nouvelle ligne.
 */
export function useInsertSousEtapeAt(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      atIndex,
      ...input
    }: Partial<VoyageSousEtape> & { atIndex: number; city: string }) => {
      const { data: existing, error: fetchError } = await supabase
        .from("voyage_sous_etapes")
        .select("id, order_index")
        .eq("etape_id", etapeId)
        .gte("order_index", atIndex)
        .order("order_index", { ascending: true });
      if (fetchError) throw fetchError;

      await Promise.all(
        (existing ?? []).map((row) =>
          supabase
            .from("voyage_sous_etapes")
            .update({ order_index: row.order_index + 1 })
            .eq("id", row.id)
            .then(({ error }) => {
              if (error) throw error;
            })
        )
      );

      const { error: insertError } = await supabase
        .from("voyage_sous_etapes")
        .insert({ ...input, etape_id: etapeId, order_index: atIndex });
      if (insertError) throw insertError;
    },
    onSuccess: () => invalidateAll(queryClient, etapeId),
  });
}

export function useUpdateSousEtape(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VoyageSousEtape> & { id: string }) => {
      const { error } = await supabase.from("voyage_sous_etapes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(queryClient, etapeId),
  });
}

export function useDeleteSousEtape(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voyage_sous_etapes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(queryClient, etapeId),
  });
}

/** Réordonne les villes d'une même étape (glisser-déposer) : réattribue order_index 0..N-1 dans l'ordre fourni. */
export function useReorderSousEtapes(etapeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from("voyage_sous_etapes").update({ order_index: index }).eq("id", id).then(({ error }) => {
            if (error) throw error;
          })
        )
      );
    },
    onSuccess: () => invalidateAll(queryClient, etapeId),
  });
}
