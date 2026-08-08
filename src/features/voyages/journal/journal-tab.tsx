import { useMemo, useState } from "react";
import { useJournalPosts, useSetJournalShareToken, journalPhotoUrl } from "@/features/voyages/journal/use-journal";
import { JournalPostComposer } from "@/features/voyages/journal/journal-post-composer";
import { JournalTimeline } from "@/features/voyages/journal/journal-timeline";
import { JournalImmersiveView, type ImmersivePost } from "@/features/voyages/journal/journal-immersive-view";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/app-url";
import { Share2, Check, PlayCircle } from "lucide-react";
import type { Voyage } from "@/types/database";

/** Onglet "Journal" du voyage : composeur de souvenirs (photos + texte), fil chronologique, et
 * gestion du lien de partage public (aucune authentification requise pour les visiteurs). */
export function JournalTab({ voyage }: { voyage: Voyage }) {
  const setShareToken = useSetJournalShareToken(voyage.id);
  const { data: posts } = useJournalPosts(voyage.id);
  const [copied, setCopied] = useState(false);
  const [immersiveOpen, setImmersiveOpen] = useState(false);

  const shareUrl = voyage.journal_share_token ? `${APP_URL}/journal/${voyage.journal_share_token}` : null;

  const immersivePosts: ImmersivePost[] = useMemo(
    () =>
      (posts ?? []).map((p) => ({
        id: p.id,
        caption: p.caption,
        entry_date: p.entry_date,
        author_name: p.author_name,
        city: p.voyage_sous_etapes?.city ?? null,
        country_region: p.voyage_sous_etapes?.voyage_etapes?.country_region ?? null,
        latitude: p.voyage_sous_etapes?.latitude ?? null,
        longitude: p.voyage_sous_etapes?.longitude ?? null,
        photo_urls: p.voyage_journal_photos.map((ph) => journalPhotoUrl(ph.storage_path)),
      })),
    [posts]
  );

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <Card className="border-accent/40 bg-gradient-to-br from-accent/10 to-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            <div>
              <p className="text-sm font-semibold">Partage public</p>
              <p className="text-xs text-muted-foreground">
                {shareUrl
                  ? "Visible par toute personne ayant ce lien, sans compte."
                  : "Non partagé — seuls toi et tes collaborateurs voient ce journal."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shareUrl && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
                {copied ? "Copié" : "Copier le lien"}
              </Button>
            )}
            <Button
              variant={shareUrl ? "outline" : "default"}
              size="sm"
              onClick={() => setShareToken.mutate(!shareUrl)}
              disabled={setShareToken.isPending}
            >
              {shareUrl ? "Désactiver" : "Activer le partage"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {immersivePosts.length > 0 && (
        <Button variant="outline" className="w-full" onClick={() => setImmersiveOpen(true)}>
          <PlayCircle className="mr-2 h-4 w-4" /> Vue immersive
        </Button>
      )}

      <JournalPostComposer voyageId={voyage.id} />
      <JournalTimeline voyageId={voyage.id} />

      <JournalImmersiveView posts={immersivePosts} open={immersiveOpen} onOpenChange={setImmersiveOpen} />
    </div>
  );
}
