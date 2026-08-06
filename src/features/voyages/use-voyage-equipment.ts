import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { VoyageEquipment } from "@/types/database";

function invalidate(queryClient: ReturnType<typeof useQueryClient>, voyageId: string) {
  queryClient.invalidateQueries({ queryKey: ["voyage-equipment", voyageId] });
  queryClient.invalidateQueries({ queryKey: ["todos"] });
}

/** Affiche l'erreur au lieu de la laisser silencieuse : sans ça, un échec de mutation (ex. la
 * migration ajoutant une colonne pas encore appliquée côté base) se traduit juste par une case
 * qui semble se cocher puis "revient en arrière" sans explication au prochain changement d'onglet. */
function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
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
    onError: onMutationError,
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
    onError: onMutationError,
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
    onError: onMutationError,
  });
}

/** Ajuste le prix unitaire estimé d'un article (alimente le coût prévisionnel équipement). */
export function useUpdateEquipmentPrice(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_price }: { id: string; unit_price: number | null }) => {
      const { error } = await supabase.from("voyage_equipment").update({ unit_price }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient, voyageId),
    onError: onMutationError,
  });
}

/** Marque un article comme déjà possédé (pas de coût, pas de tâche auto) ou pas ; voir le
 * trigger sync_equipment_todo côté base pour la gestion automatique de la tâche liée. */
export function useUpdateEquipmentOwned(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, owned }: { id: string; owned: boolean }) => {
      const { error } = await supabase.from("voyage_equipment").update({ owned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient, voyageId),
    onError: onMutationError,
  });
}
