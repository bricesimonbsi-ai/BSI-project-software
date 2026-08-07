import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Category } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; icon?: string | null; position: number }) => {
      const { error } = await supabase.from("categories").insert(input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: onMutationError,
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Category> & { id: string }) => {
      const { error } = await supabase.from("categories").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: onMutationError,
  });
}
