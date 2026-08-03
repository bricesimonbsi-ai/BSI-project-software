import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import type { Todo } from "@/types/database";

export function useTodos(projectId?: string) {
  return useQuery({
    queryKey: projectId ? ["todos", "project", projectId] : ["todos", "all"],
    queryFn: async (): Promise<Todo[]> => {
      let query = supabase.from("todos").select("*").order("done", { ascending: true }).order("due_date", { ascending: true });
      query = projectId ? query.eq("project_id", projectId) : query;
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { title: string; project_id?: string | null; due_date?: string | null }) => {
      if (!session) throw new Error("Non authentifié");
      const { error } = await supabase.from("todos").insert({
        title: input.title,
        project_id: input.project_id ?? null,
        due_date: input.due_date ?? null,
        created_by: session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useToggleTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("todos").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}
