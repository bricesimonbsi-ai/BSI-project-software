import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { suggestFoodIcon, suggestFoodCategory } from "@/features/shopping/food-icons";
import type { ShoppingListItem } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useShoppingListItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["shopping-list-items", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ShoppingListItem[]> => {
      const { data, error } = await supabase
        .from("shopping_list_items")
        .select("*")
        .eq("project_id", projectId as string)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddShoppingItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; quantity: string | null; icon?: string | null }) => {
      const { data: existing } = await supabase
        .from("shopping_list_items")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = (existing?.[0]?.position ?? -1) + 1;
      const { error } = await supabase.from("shopping_list_items").insert({
        project_id: projectId,
        name: input.name,
        quantity: input.quantity,
        icon: input.icon ?? suggestFoodIcon(input.name),
        category: suggestFoodCategory(input.name),
        position: nextPosition,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-list-items", projectId] }),
    onError: onMutationError,
  });
}

export function useToggleShoppingItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from("shopping_list_items").update({ checked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-list-items", projectId] }),
    onError: onMutationError,
  });
}

export function useUpdateShoppingItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      quantity?: string | null;
      icon?: string | null;
      category?: string | null;
    }) => {
      const { error } = await supabase.from("shopping_list_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-list-items", projectId] }),
    onError: onMutationError,
  });
}

export function useDeleteShoppingItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-list-items", projectId] }),
    onError: onMutationError,
  });
}

/** Copie tous les articles d'une liste source (non cochés) vers une liste tout juste créée —
 * utilisé par "repartir d'une liste existante" à la création d'une nouvelle liste de courses. */
export async function copyShoppingListItems(sourceProjectId: string, targetProjectId: string) {
  const { data: sourceItems, error } = await supabase
    .from("shopping_list_items")
    .select("name, quantity, icon, category, position")
    .eq("project_id", sourceProjectId)
    .order("position", { ascending: true });
  if (error) throw error;
  if (!sourceItems || sourceItems.length === 0) return;

  const { error: insertError } = await supabase.from("shopping_list_items").insert(
    sourceItems.map((item) => ({
      project_id: targetProjectId,
      name: item.name,
      quantity: item.quantity,
      icon: item.icon,
      category: item.category,
      position: item.position,
      checked: false,
    }))
  );
  if (insertError) throw insertError;
}
