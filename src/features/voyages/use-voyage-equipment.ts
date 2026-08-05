import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import type { VoyageEquipment } from "@/types/database";

function invalidate(queryClient: ReturnType<typeof useQueryClient>, voyageId: string) {
  queryClient.invalidateQueries({ queryKey: ["voyage-equipment", voyageId] });
  queryClient.invalidateQueries({ queryKey: ["todos"] });
}

export function useVoyageEquipment(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-equipment", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageEquipment[]> => {
      const { data, error } = await supabase
        .from("voyage_equipment")
        .select("*")
        .eq("voyage_id", voyageId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Coche un article du catalogue (crée la ligne — l'absence de ligne = non coché) ; déclenche
 * automatiquement la création d'une tâche "Prévoir : ..." côté base. */
export function useCheckEquipment(voyageId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { category: string; name: string; quantity?: number }) => {
      if (!session) throw new Error("Non authentifié");
      const { error } = await supabase.from("voyage_equipment").insert({
        voyage_id: voyageId,
        category: input.category,
        name: input.name,
        quantity: input.quantity ?? 1,
        created_by: session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient, voyageId),
  });
}

/** Décoche un article (supprime la ligne) ; la tâche liée disparaît automatiquement (cascade). */
export function useUncheckEquipment(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voyage_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient, voyageId),
  });
}

export function useUpdateEquipmentQuantity(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("voyage_equipment").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient, voyageId),
  });
}
