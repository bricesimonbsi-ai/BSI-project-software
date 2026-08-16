import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { GiftItem, GiftOccasion, GiftStatus } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useGiftItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["gift-items", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<GiftItem[]> => {
      const { data, error } = await supabase
        .from("gift_items")
        .select("*")
        .eq("project_id", projectId as string)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateGiftItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      person_id: string | null;
      occasion: GiftOccasion;
      price_estimate: number | null;
      link: string | null;
      notes: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("gift_items")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = (existing?.[0]?.position ?? -1) + 1;
      const { error } = await supabase.from("gift_items").insert({ ...input, project_id: projectId, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gift-items", projectId] }),
    onError: onMutationError,
  });
}

export function useUpdateGiftItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      person_id?: string | null;
      occasion?: GiftOccasion;
      status?: GiftStatus;
      price_estimate?: number | null;
      link?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await supabase.from("gift_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gift-items", projectId] }),
    onError: onMutationError,
  });
}

export function useDeleteGiftItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gift_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gift-items", projectId] }),
    onError: onMutationError,
  });
}
