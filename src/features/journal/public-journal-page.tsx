import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { journalPhotoUrl } from "@/features/voyages/journal/use-journal";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { MapPin } from "lucide-react";
import type { PublicJournalEntry, PublicJournalMeta } from "@/types/database";

/**
 * Page publique du journal de voyage : accessible sans authentification via un lien de partage
 * (voyages.journal_share_token). N'utilise jamais la session de l'app — les fonctions RPC
 * appelées sont SECURITY DEFINER et accordées au rôle "anon", tout visiteur peut donc consulter
 * ce journal (mais rien d'autre : aucune autre donnée du portefeuille n'est exposée).
 */
export function PublicJournalPage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<PublicJournalMeta | null | undefined>(undefined);
  const [entries, setEntries] = useState<PublicJournalEntry[]>([]);
  const [lightbox, setLightbox] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [metaRes, entriesRes] = await Promise.all([
        supabase.rpc("get_public_journal_meta", { p_share_token: token }).maybeSingle(),
        supabase.rpc("get_public_journal", { p_share_token: token }),
      ]);
      if (cancelled) return;
      setMeta((metaRes.data as PublicJournalMeta | null) ?? null);
      setEntries((entriesRes.data as PublicJournalEntry[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dateRange = useMemo(() => {
    if (!meta?.start_date || !meta?.end_date) return null;
    return `${formatDate(meta.start_date)} → ${formatDate(meta.end_date)}`;
  }, [meta]);

  if (meta === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  }

  if (meta === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-lg font-semibold">Ce journal n'est pas (ou plus) partagé.</p>
        <p className="text-sm text-muted-foreground">Le lien est peut-être expiré ou a été désactivé par son auteur.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-[radial-gradient(circle_at_50%_0%,_hsl(250_35%_16%),_transparent_55%)]">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="space-y-2 text-center">
          <div className="text-4xl">{meta.icon ?? "🌍"}</div>
          <h1 className="text-3xl font-bold">{meta.title}</h1>
          {dateRange && <p className="text-sm text-muted-foreground">{dateRange}</p>}
        </div>

        {entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucun souvenir publié pour l'instant.</p>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => {
              const urls = entry.photo_paths.map((p) => journalPhotoUrl(p));
              return (
                <div key={entry.post_id} className="overflow-hidden rounded-xl border border-border bg-card">
                  {urls.length > 0 && (
                    <PhotoCollage
                      urls={urls}
                      onPhotoClick={(i) => {
                        setLightbox(urls);
                        setLightboxIndex(i);
                      }}
                    />
                  )}
                  <div className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.author_name}</span>
                      <span className="flex items-center gap-2">
                        {entry.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {entry.city}
                          </span>
                        )}
                        {formatDate(entry.entry_date)}
                      </span>
                    </div>
                    {entry.caption && <p className="whitespace-pre-wrap text-sm">{entry.caption}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">Publié avec Projeko</p>
      </div>

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          {lightbox && <img src={lightbox[lightboxIndex]} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
