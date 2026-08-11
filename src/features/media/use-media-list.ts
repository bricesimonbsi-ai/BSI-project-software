import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { MediaItem, MediaType } from "@/types/database";
import type { TmdbMovieResult } from "@/features/media/tmdb";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useMediaItems(projectId: string | undefined, type: MediaType) {
  return useQuery({
    queryKey: ["media-items", projectId, type],
    enabled: !!projectId,
    queryFn: async (): Promise<MediaItem[]> => {
      const { data, error } = await supabase
        .from("media_items")
        .select("*")
        .eq("project_id", projectId as string)
        .eq("type", type)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddMovie(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (movie: TmdbMovieResult) => {
      const { data: existing } = await supabase
        .from("media_items")
        .select("position")
        .eq("project_id", projectId)
        .eq("type", "film")
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = (existing?.[0]?.position ?? -1) + 1;
      const { error } = await supabase.from("media_items").insert({
        project_id: projectId,
        type: "film",
        external_id: String(movie.id),
        title: movie.title,
        poster_path: movie.poster_path,
        synopsis: movie.overview || null,
        release_date: movie.release_date || null,
        external_rating: movie.vote_average || null,
        position: nextPosition,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-items", projectId] }),
    onError: onMutationError,
  });
}

export function useToggleWatched(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, watched }: { id: string; watched: boolean }) => {
      const { error } = await supabase
        .from("media_items")
        .update({ watched, watched_at: watched ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-items", projectId] }),
    onError: onMutationError,
  });
}

export function useUpdateMediaItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; platform?: string | null }) => {
      const { error } = await supabase.from("media_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-items", projectId] }),
    onError: onMutationError,
  });
}

export function useDeleteMediaItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-items", projectId] }),
    onError: onMutationError,
  });
}
