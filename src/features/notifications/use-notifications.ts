import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import type { NotificationRow } from "@/types/database";

export function useNotifications() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  const unreadCount = (query.data ?? []).filter((n) => !n.read_at).length;

  return { ...query, unreadCount, markRead };
}
