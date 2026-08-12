import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PublicMediaMeta, PublicMediaSynthesisItem } from "@/types/database";

/** Synthèse publique (notes/commentaires personnels) d'un projet média, via RPC SECURITY DEFINER
 * gated par le token de partage — même principe que le journal public (voir 0044). */
export function usePublicMediaSynthesis(token: string | undefined) {
  const [meta, setMeta] = useState<PublicMediaMeta | null | undefined>(undefined);
  const [items, setItems] = useState<PublicMediaSynthesisItem[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [metaRes, itemsRes] = await Promise.all([
        supabase.rpc("get_public_media_meta", { p_share_token: token }).maybeSingle(),
        supabase.rpc("get_public_media_synthesis", { p_share_token: token }),
      ]);
      if (cancelled) return;
      setMeta((metaRes.data as PublicMediaMeta | null) ?? null);
      setItems((itemsRes.data as PublicMediaSynthesisItem[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { meta, items };
}
