import { useMemo, useState } from "react";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  useJournalPosts,
  useDeleteJournalPost,
  useJournalSocial,
  useReplyToComment,
  journalPhotoUrl,
  type JournalPostWithPhotos,
} from "@/features/voyages/journal/use-journal";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, cn } from "@/lib/utils";
import { Trash2, MapPin, Pencil } from "lucide-react";
import type { JournalPostComment, JournalPostReaction } from "@/types/database";

export function JournalTimeline({ voyageId, onEdit }: { voyageId: string; onEdit: (post: JournalPostWithPhotos) => void }) {
  const { data: posts, isLoading } = useJournalPosts(voyageId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: sousEtapes } = useVoyageSousEtapes(voyageId);
  const deletePost = useDeleteJournalPost(voyageId);
  const postIds = useMemo(() => (posts ?? []).map((p) => p.id), [posts]);
  const { data: social } = useJournalSocial(voyageId, postIds);
  const replyToComment = useReplyToComment(voyageId);
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
          reactions={(social?.reactions ?? []).filter((r) => r.post_id === post.id)}
          comments={(social?.comments ?? []).filter((c) => c.post_id === post.id)}
          onDelete={() => deletePost.mutate(post)}
          onEdit={() => onEdit(post)}
          onReply={(commentId, content) => replyToComment.mutate({ postId: post.id, parentCommentId: commentId, content })}
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
  reactions,
  comments,
  onDelete,
  onEdit,
  onReply,
  onOpenPhoto,
}: {
  post: JournalPostWithPhotos;
  location?: { city: string; country: string };
  reactions: JournalPostReaction[];
  comments: JournalPostComment[];
  onDelete: () => void;
  onEdit: () => void;
  onReply: (commentId: string, content: string) => void;
  onOpenPhoto: (urls: string[], index: number) => void;
}) {
  const urls = post.voyage_journal_photos.map((p) => journalPhotoUrl(p.storage_path));
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const reactionsByEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const list = reactionsByEmoji.get(r.emoji) ?? [];
    list.push(r.visitor_name);
    reactionsByEmoji.set(r.emoji, list);
  }
  const rootComments = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, JournalPostComment[]>();
  for (const c of comments) {
    if (!c.parent_comment_id) continue;
    const list = repliesByParent.get(c.parent_comment_id) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_comment_id, list);
  }

  function submitReply(commentId: string) {
    if (!replyText.trim()) return;
    onReply(commentId, replyText.trim());
    setReplyingTo(null);
    setReplyText("");
  }

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
                  {location.city}, {location.country}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} title="Modifier ce souvenir">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Supprimer ce souvenir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {urls.length > 0 && <PhotoCollage urls={urls} onPhotoClick={(i) => onOpenPhoto(urls, i)} />}

        {post.caption && <p className="whitespace-pre-wrap text-sm">{post.caption}</p>}

        {reactionsByEmoji.size > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            {[...reactionsByEmoji.entries()].map(([emoji, names]) => (
              <span key={emoji} title={names.join(", ")}>
                {emoji} {names.join(", ")}
              </span>
            ))}
          </div>
        )}

        {rootComments.length > 0 && (
          <div className={cn("space-y-2", reactionsByEmoji.size === 0 && "border-t border-border pt-2")}>
            {rootComments.map((c) => (
              <div key={c.id} className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">{c.author_name}</span> <span className="whitespace-pre-wrap">{c.content}</span>
                </p>
                {(repliesByParent.get(c.id) ?? []).map((r) => (
                  <p key={r.id} className="ml-4 border-l-2 border-accent/40 pl-2 text-sm">
                    <span className="font-medium text-accent">{r.author_name}</span>{" "}
                    <span className="whitespace-pre-wrap">{r.content}</span>
                  </p>
                ))}
                {replyingTo === c.id ? (
                  <div className="ml-4 flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitReply(c.id)}
                      placeholder="Répondre..."
                      className="h-7 text-xs"
                    />
                    <Button size="sm" className="h-7 flex-shrink-0" onClick={() => submitReply(c.id)} disabled={!replyText.trim()}>
                      Envoyer
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ml-4 text-xs text-muted-foreground hover:underline"
                    onClick={() => {
                      setReplyingTo(c.id);
                      setReplyText("");
                    }}
                  >
                    Répondre
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
