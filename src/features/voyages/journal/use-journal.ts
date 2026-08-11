import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { VoyageJournalPost, VoyageJournalPhoto } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

const BUCKET = "voyage-journal";

export type JournalPostWithPhotos = VoyageJournalPost & { voyage_journal_photos: VoyageJournalPhoto[] };

export function journalPhotoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function useJournalPosts(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-journal-posts", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<JournalPostWithPhotos[]> => {
      const { data, error } = await supabase
        .from("voyage_journal_posts")
        .select("*, voyage_journal_photos(*)")
        .eq("voyage_id", voyageId as string)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as JournalPostWithPhotos[]).map((p) => ({
        ...p,
        voyage_journal_photos: [...p.voyage_journal_photos].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

export function useCreateJournalPost(voyageId: string) {
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  return useMutation({
    mutationFn: async (input: { caption: string; entryDate: string; sousEtapeId: string | null; files: File[] }) => {
      if (!session) throw new Error("Non authentifié");

      const { data: post, error: postError } = await supabase
        .from("voyage_journal_posts")
        .insert({
          voyage_id: voyageId,
          author_id: session.user.id,
          author_name: profile?.display_name || session.user.email || "Voyageur",
          sous_etape_id: input.sousEtapeId,
          caption: input.caption || null,
          entry_date: input.entryDate,
        })
        .select("*")
        .single();
      if (postError) throw postError;

      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const path = `${voyageId}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase
          .from("voyage_journal_photos")
          .insert({ post_id: post.id, storage_path: path, position: i });
        if (photoError) throw photoError;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voyage-journal-posts", voyageId] }),
    onError: onMutationError,
  });
}

export function useUpdateJournalPost(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      caption: string;
      entryDate: string;
      sousEtapeId: string | null;
      newFiles: File[];
      removedPhotos: VoyageJournalPhoto[];
      keptPhotoCount: number;
    }) => {
      const { error: updateError } = await supabase
        .from("voyage_journal_posts")
        .update({
          caption: input.caption || null,
          entry_date: input.entryDate,
          sous_etape_id: input.sousEtapeId,
        })
        .eq("id", input.id);
      if (updateError) throw updateError;

      if (input.removedPhotos.length > 0) {
        const paths = input.removedPhotos.map((p) => p.storage_path);
        await supabase.storage.from(BUCKET).remove(paths);
        const { error: deleteError } = await supabase
          .from("voyage_journal_photos")
          .delete()
          .in(
            "id",
            input.removedPhotos.map((p) => p.id)
          );
        if (deleteError) throw deleteError;
      }

      for (let i = 0; i < input.newFiles.length; i++) {
        const file = input.newFiles[i];
        const path = `${voyageId}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase
          .from("voyage_journal_photos")
          .insert({ post_id: input.id, storage_path: path, position: input.keptPhotoCount + i });
        if (photoError) throw photoError;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voyage-journal-posts", voyageId] }),
    onError: onMutationError,
  });
}

export function useDeleteJournalPost(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: JournalPostWithPhotos) => {
      const paths = post.voyage_journal_photos.map((p) => p.storage_path);
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase.from("voyage_journal_posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voyage-journal-posts", voyageId] }),
    onError: onMutationError,
  });
}

/** Active/régénère (nouveau token) ou désactive (token null) le lien de partage public du journal. */
export function useSetJournalShareToken(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enable: boolean) => {
      const journal_share_token = enable ? crypto.randomUUID() : null;
      const { error } = await supabase.from("voyages").update({ journal_share_token }).eq("id", voyageId);
      if (error) throw error;
      return journal_share_token;
    },
    // Clé de cache "voyage" indexée par project_id (pas voyage_id) ailleurs dans l'app : on
    // invalide largement plutôt que de reconstruire cette clé ici.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voyage"] }),
    onError: onMutationError,
  });
}
