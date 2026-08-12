import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { NotificationTypePreference } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

/** Préférences de notification de l'utilisateur courant, par type et par projet — absence de
 * ligne pour une combinaison donnée = notification active (comportement par défaut). */
export function useNotificationTypePreferences() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["notification-type-preferences", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<NotificationTypePreference[]> => {
      const { data, error } = await supabase.from("notification_type_preferences").select("*").eq("user_id", session!.user.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetNotificationTypePreference() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { notificationType: string; projectId: string; enabled: boolean }) => {
      if (!session) throw new Error("Non authentifié");
      const { error } = await supabase.from("notification_type_preferences").upsert(
        {
          user_id: session.user.id,
          notification_type: input.notificationType,
          project_id: input.projectId,
          enabled: input.enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,notification_type,project_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-type-preferences"] }),
    onError: onMutationError,
  });
}
