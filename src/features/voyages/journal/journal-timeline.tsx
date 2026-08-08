import { useMemo, useState } from "react";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useJournalPosts, useDeleteJournalPost, journalPhotoUrl, type JournalPostWithPhotos } from "@/features/voyages/journal/use-journal";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Trash2, MapPin } from "lucide-react";

export function JournalTimeline({ voyageId }: { voyageId: string }) {
  const { data: posts, isLoading } = useJournalPosts(voyageId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: sousEtapes } = useVoyageSousEtapes(voyageId);
  const deletePost = useDeleteJournalPost(voyageId);
  const [lightbox, setLightbox] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const locationBySousEtape = useMemo(() => {
    const etapeById = new Map((etapes ?? []).map((e) => [e.id, e]));
    const map = new Map<string, { city: string; country: string }>();
    for (const se of sousEtapes ?? []) {
      const etape = etapeById.get(se.etape_id);
      if (etape) map.set(se.id, { city: se.city, country: etape.country_region });
    }
    return map;
  }, [etapes, sousEtapes]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  if (!posts || posts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucun souvenir publié pour l'instant — ajoutez le premier !</p>;
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <JournalPostCard
          key={post.id}
          post={post}
          location={post.sous_etape_id ? locationBySousEtape.get(post.sous_etape_id) : undefined}
          onDelete={() => deletePost.mutate(post)}
          onOpenPhoto={(urls, index) => {
            setLightbox(urls);
            setLightboxIndex(index);
          }}
        />
      ))}

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          {lightbox && <img src={lightbox[lightboxIndex]} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JournalPostCard({
  post,
  location,
  onDelete,
  onOpenPhoto,
}: {
  post: JournalPostWithPhotos;
  location?: { city: string; country: string };
  onDelete: () => void;
  onOpenPhoto: (urls: string[], index: number) => void;
}) {
  const urls = post.voyage_journal_photos.map((p) => journalPhotoUrl(p.storage_path));

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{post.author_name}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatDate(post.entry_date)}</span>
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <CountryFlag name={location.country} className="text-sm" />
                  {location.city}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Supprimer ce souvenir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {urls.length > 0 && <PhotoCollage urls={urls} onPhotoClick={(i) => onOpenPhoto(urls, i)} />}

        {post.caption && <p className="whitespace-pre-wrap text-sm">{post.caption}</p>}
      </CardContent>
    </Card>
  );
}
