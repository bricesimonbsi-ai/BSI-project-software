import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { GiftItem, GiftItemRecipient, GiftStatus } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

/** Un destinataire pas encore enregistré — person_id XOR name, jamais les deux (voir la contrainte
 * côté base, gift_item_recipients_person_xor_name). */
export type RecipientInput = { person_id: string | null; name: string | null };

export type GiftItemWithRecipients = GiftItem & { recipients: GiftItemRecipient[] };

export function useGiftItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["gift-items", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<GiftItemWithRecipients[]> => {
      const { data, error } = await supabase
        .from("gift_items")
        .select("*, recipients:gift_item_recipients(*)")
        .eq("project_id", projectId as string)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as GiftItemWithRecipients[];
      return rows.map((row) => ({
        ...row,
        recipients: [...row.recipients].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

export function useCreateGiftItem(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; recipients: RecipientInput[]; link: string | null }) => {
      const { data: existing } = await supabase
        .from("gift_items")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = (existing?.[0]?.position ?? -1) + 1;
      const { data: created, error } = await supabase
        .from("gift_items")
        .insert({ title: input.title, link: input.link, project_id: projectId, position: nextPosition })
        .select("id")
        .single();
      if (error) throw error;
      if (input.recipients.length > 0) {
        const { error: recipientsError } = await supabase.from("gift_item_recipients").insert(
          input.recipients.map((r, i) => ({ gift_item_id: created.id, person_id: r.person_id, name: r.name, position: i }))
        );
        if (recipientsError) throw recipientsError;
      }
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
      status?: GiftStatus;
      link?: string | null;
    }) => {
      const { error } = await supabase.from("gift_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gift-items", projectId] }),
    onError: onMutationError,
  });
}

/** Remplace intégralement les destinataires d'une idée (pas de diff fin : plus simple et sans
 * risque d'incohérence que de calculer qui ajouter/retirer/réordonner côté client). */
export function useSetGiftItemRecipients(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ giftItemId, recipients }: { giftItemId: string; recipients: RecipientInput[] }) => {
      const { error: deleteError } = await supabase.from("gift_item_recipients").delete().eq("gift_item_id", giftItemId);
      if (deleteError) throw deleteError;
      if (recipients.length === 0) return;
      const { error: insertError } = await supabase.from("gift_item_recipients").insert(
        recipients.map((r, i) => ({ gift_item_id: giftItemId, person_id: r.person_id, name: r.name, position: i }))
      );
      if (insertError) throw insertError;
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
