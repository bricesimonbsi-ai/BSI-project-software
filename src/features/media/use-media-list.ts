import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { fetchWatchProviders } from "@/features/media/tmdb";
import type { MediaItem, MediaItemWatcher, MediaType, Person } from "@/types/database";

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

async function nextPosition(projectId: string, type: MediaType): Promise<number> {
  const { data } = await supabase
    .from("media_items")
    .select("position")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

export type TmdbAddInput = {
  external_id: string;
  title: string;
  poster_path: string | null;
  synopsis: string | null;
  release_date: string | null;
  external_rating: number | null;
};

/** Ajoute un film ou une série trouvé(e) via TMDB — "où le voir" est récupéré automatiquement
 * (plateformes de streaming disponibles en France) au moment de l'ajout. */
export function useAddTmdbMedia(projectId: string, type: "film" | "serie") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TmdbAddInput) => {
      const [position, platforms] = await Promise.all([
        nextPosition(projectId, type),
        fetchWatchProviders(type === "film" ? "movie" : "tv", input.external_id),
      ]);
      const { error } = await supabase.from("media_items").insert({
        project_id: projectId,
        type,
        external_id: input.external_id,
        title: input.title,
        poster_path: input.poster_path,
        synopsis: input.synopsis,
        release_date: input.release_date,
        external_rating: input.external_rating,
        platforms,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-items", projectId] }),
    onError: onMutationError,
  });
}

/** Ajoute un jeu vidéo saisi manuellement (pas de source automatique disponible) — les plateformes
 * sont les consoles cochées par l'utilisateur. */
export function useAddManualMedia(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; platforms: string[] }) => {
      const position = await nextPosition(projectId, "jeu");
      const { error } = await supabase.from("media_items").insert({
        project_id: projectId,
        type: "jeu",
        title: input.title,
        platforms: input.platforms,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media-items", projectId] }),
    onError: onMutationError,
  });
}

/** Coche/décoche "vu"/"joué" ; en cochant, `viewerIds` précise qui l'a vu/joué (remplace la liste
 * précédente) — en décochant, la liste des personnes est effacée (n'a plus de sens). */
export function useToggleWatched(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, watched, viewerIds }: { id: string; watched: boolean; viewerIds?: string[] }) => {
      const { error } = await supabase
        .from("media_items")
        .update({ watched, watched_at: watched ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;

      const { error: clearError } = await supabase.from("media_item_watchers").delete().eq("media_item_id", id);
      if (clearError) throw clearError;

      if (watched && viewerIds && viewerIds.length > 0) {
        const { error: insertError } = await supabase
          .from("media_item_watchers")
          .insert(viewerIds.map((person_id) => ({ media_item_id: id, person_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["media-item-watchers", projectId] });
    },
    onError: onMutationError,
  });
}

type WatcherRow = MediaItemWatcher & { people: Person };

/** Qui a vu/joué chaque contenu (parmi les identifiants passés), avec les infos de la personne
 * (nom, avatar) pour l'affichage. */
export function useMediaItemWatchers(projectId: string, itemIds: string[]) {
  const idsKey = [...itemIds].sort().join(",");
  return useQuery({
    queryKey: ["media-item-watchers", projectId, idsKey],
    enabled: itemIds.length > 0,
    queryFn: async (): Promise<WatcherRow[]> => {
      const { data, error } = await supabase.from("media_item_watchers").select("*, people(*)").in("media_item_id", itemIds);
      if (error) throw error;
      return (data ?? []) as unknown as WatcherRow[];
    },
  });
}

export function useUpdateMediaItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; platforms?: string[] }) => {
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
