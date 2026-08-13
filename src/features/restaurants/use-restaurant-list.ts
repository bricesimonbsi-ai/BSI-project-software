import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { RestaurantItem, RestaurantItemVisitor, RestaurantItemRating, Person } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useRestaurantItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["restaurant-items", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<RestaurantItem[]> => {
      const { data, error } = await supabase
        .from("restaurant_items")
        .select("*")
        .eq("project_id", projectId as string)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function nextPosition(projectId: string): Promise<number> {
  const { data } = await supabase
    .from("restaurant_items")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

export type PlaceAddInput = {
  place_id: string;
  name: string;
  address: string | null;
  categories: string[];
  photo_url: string | null;
  google_rating: number | null;
  price_level: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string[];
  latitude: number | null;
  longitude: number | null;
};

/** Ajoute un lieu trouvé via Google Places — tous les champs "où" sont déjà fournis par la
 * recherche/les suggestions à proximité (pas d'appel de détail séparé). */
export function useAddPlaceRestaurant(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlaceAddInput) => {
      const position = await nextPosition(projectId);
      const { error } = await supabase.from("restaurant_items").insert({ project_id: projectId, position, ...input });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant-items", projectId] }),
    onError: onMutationError,
  });
}

/** Ajoute un lieu saisi manuellement (repli utilisé tant que la clé Google Places n'est pas
 * configurée) — seuls nom et adresse sont demandés. */
export function useAddManualRestaurant(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; address: string }) => {
      const position = await nextPosition(projectId);
      const { error } = await supabase.from("restaurant_items").insert({
        project_id: projectId,
        name: input.name,
        address: input.address || null,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant-items", projectId] }),
    onError: onMutationError,
  });
}

/** Coche/décoche "visité" ; en cochant, `visitorIds` précise qui y est allé (remplace la liste
 * précédente) — en décochant, la liste des personnes est effacée (n'a plus de sens). */
export function useToggleVisited(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, visited, visitorIds }: { id: string; visited: boolean; visitorIds?: string[] }) => {
      const { error } = await supabase
        .from("restaurant_items")
        .update({ visited, visited_at: visited ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;

      const { error: clearError } = await supabase.from("restaurant_item_visitors").delete().eq("restaurant_item_id", id);
      if (clearError) throw clearError;

      if (visited && visitorIds && visitorIds.length > 0) {
        const { error: insertError } = await supabase
          .from("restaurant_item_visitors")
          .insert(visitorIds.map((person_id) => ({ restaurant_item_id: id, person_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["restaurant-item-visitors", projectId] });
    },
    onError: onMutationError,
  });
}

type VisitorRow = RestaurantItemVisitor & { people: Person };

export function useRestaurantItemVisitors(projectId: string, itemIds: string[]) {
  const idsKey = [...itemIds].sort().join(",");
  return useQuery({
    queryKey: ["restaurant-item-visitors", projectId, idsKey],
    enabled: itemIds.length > 0,
    queryFn: async (): Promise<VisitorRow[]> => {
      const { data, error } = await supabase.from("restaurant_item_visitors").select("*, people(*)").in("restaurant_item_id", itemIds);
      if (error) throw error;
      return (data ?? []) as unknown as VisitorRow[];
    },
  });
}

type RatingRow = RestaurantItemRating & { people: Person };

export function useRestaurantItemRatings(projectId: string, itemIds: string[]) {
  const idsKey = [...itemIds].sort().join(",");
  return useQuery({
    queryKey: ["restaurant-item-ratings", projectId, idsKey],
    enabled: itemIds.length > 0,
    queryFn: async (): Promise<RatingRow[]> => {
      const { data, error } = await supabase.from("restaurant_item_ratings").select("*, people(*)").in("restaurant_item_id", itemIds);
      if (error) throw error;
      return (data ?? []) as unknown as RatingRow[];
    },
  });
}

/** Pose ou met à jour la note/le commentaire d'une personne sur un lieu (une seule note par
 * personne et par lieu — modifiable dans le temps, jamais un historique). */
export function useSetRestaurantItemRating(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { restaurantItemId: string; personId: string; rating: number; comment: string | null }) => {
      const { error } = await supabase
        .from("restaurant_item_ratings")
        .upsert(
          {
            restaurant_item_id: input.restaurantItemId,
            person_id: input.personId,
            rating: input.rating,
            comment: input.comment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "restaurant_item_id,person_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant-item-ratings", projectId] }),
    onError: onMutationError,
  });
}

export function useDeleteRestaurantItemRating(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_item_ratings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant-item-ratings", projectId] }),
    onError: onMutationError,
  });
}

export function useDeleteRestaurantItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurant-items", projectId] }),
    onError: onMutationError,
  });
}
