import { useState } from "react";
import { useSetJournalShareToken, type JournalPostWithPhotos } from "@/features/voyages/journal/use-journal";
import { JournalPostComposer } from "@/features/voyages/journal/journal-post-composer";
import { JournalTimeline } from "@/features/voyages/journal/journal-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/app-url";
import { Share2, Check } from "lucide-react";
import type { Voyage } from "@/types/database";

/** Onglet "Journal" du voyage : composeur de souvenirs (photos + texte), fil chronologique, et
 * gestion du lien de partage public (aucune authentification requise pour les visiteurs). */
export function JournalTab({ voyage }: { voyage: Voyage }) {
  const setShareToken = useSetJournalShareToken(voyage.id);
  const [copied, setCopied] = useState(false);
  const [editingPost, setEditingPost] = useState<JournalPostWithPhotos | null>(null);

  const shareUrl = voyage.journal_share_token ? `${APP_URL}/journal/${voyage.journal_share_token}` : null;

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

      <JournalPostComposer voyageId={voyage.id} editingPost={editingPost} onDone={() => setEditingPost(null)} />
      <JournalTimeline voyageId={voyage.id} onEdit={setEditingPost} />
    </div>
  );
}
