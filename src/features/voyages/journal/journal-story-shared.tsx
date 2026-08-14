import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import type { JournalCommentReaction, JournalPostComment, JournalPostReaction } from "@/types/database";

const LIGHTBOX_AUTO_ADVANCE_MS = 4000;
const TAP_MAX_MS = 300;
const SWIPE_THRESHOLD_PX = 50;
const SWIPE_DOWN_CLOSE_PX = 80;
const DISMISS_RESISTANCE = 0.55;

/** Précharge les images voisines (index-1, index+1) pour éviter un flash/chargement visible au
 * changement de photo — le navigateur garde l'image en cache, `<img>` l'affiche alors instantanément. */
function usePreloadNeighbors(urls: string[], index: number) {
  useEffect(() => {
    for (const i of [index - 1, index + 1]) {
      const url = urls[i];
      if (url) new Image().src = url;
    }
  }, [urls, index]);
}

/** Visionneuse façon "story" : défilement automatique après un temps limité, navigation par
 * appui sur les côtés gauche/droite de la photo ou par glissement horizontal (swipe), glisser
 * vers le bas ferme la visionneuse (comme Instagram, `onDismiss` — distinct de `onExhausted` :
 * l'un ferme tout, l'autre enchaîne sur le contenu suivant), et rester appuyé (n'importe où sur
 * la photo) met le défilement en pause tant qu'on ne relâche pas. Le geste est suivi en direct
 * (la photo suit le doigt via une transformation CSS appliquée directement au DOM, hors du cycle
 * de rendu React) pour rester fluide même sur les appareils modestes ; seul le résultat du geste
 * (changement d'index, fermeture) passe par l'état React. Une seule gestion pointer unifiée
 * (souris + tactile) pilote le tout. Partagé entre la vue Carte privée et la vue Carte publique. */
export function StoryLightbox({
  urls,
  index,
  onIndexChange,
  onExhausted,
  onDismiss,
}: {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Swipe/tap au-delà de la dernière photo (ou fin du défilement auto) — enchaîne sur l'étape
   * suivante côté appelant, sans fermer la fenêtre. */
  onExhausted: () => void;
  /** Glisser vers le bas — ferme complètement la visionneuse. */
  onDismiss: () => void;
}) {
  const hasMultiple = urls.length > 1;
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  usePreloadNeighbors(urls, index);

  function goPrev() {
    if (index > 0) onIndexChange(index - 1);
  }

  function goNext() {
    if (index < urls.length - 1) onIndexChange(index + 1);
    else onExhausted();
  }

  function resetTransform(animate: boolean) {
    const el = dragRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 180ms ease-out, opacity 180ms ease-out" : "none";
    el.style.transform = "translate3d(0,0,0)";
    el.style.opacity = "1";
  }

  useEffect(() => {
    resetTransform(false);
    setProgress(0);
    lastTsRef.current = null;
  }, [index]);

  useEffect(() => {
    if (!hasMultiple || paused) {
      lastTsRef.current = null;
      return;
    }
    function tick(ts: number) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setProgress((p) => Math.min(1, p + delta / LIGHTBOX_AUTO_ADVANCE_MS));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [index, hasMultiple, paused]);

  useEffect(() => {
    if (progress >= 1 && index < urls.length - 1) onIndexChange(index + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    setPaused(true);
    const el = dragRef.current;
    if (el) el.style.transition = "none";
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current;
    const el = dragRef.current;
    if (!start || !el) return;
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    // Le glissement vertical (fermeture) domine dès qu'il est plus prononcé que l'horizontal ;
    // une légère résistance rend le geste moins "collant" au doigt qu'un suivi 1:1 (ressenti Instagram).
    if (deltaY > 0 && deltaY > Math.abs(deltaX)) {
      const y = deltaY * DISMISS_RESISTANCE;
      el.style.transform = `translate3d(0,${y}px,0)`;
      el.style.opacity = String(Math.max(0.4, 1 - y / 400));
    } else if (hasMultiple) {
      el.style.transform = `translate3d(${deltaX}px,0,0)`;
      el.style.opacity = "1";
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current;
    pointerRef.current = null;
    setPaused(false);
    if (!start) {
      resetTransform(true);
      return;
    }
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    const elapsed = Date.now() - start.time;

    if (deltaY > SWIPE_DOWN_CLOSE_PX && deltaY > Math.abs(deltaX)) {
      const el = dragRef.current;
      if (el) {
        el.style.transition = "transform 160ms ease-in, opacity 160ms ease-in";
        el.style.transform = "translate3d(0,60vh,0)";
        el.style.opacity = "0";
      }
      setTimeout(onDismiss, 140);
      return;
    }
    if (!hasMultiple) {
      resetTransform(true);
      return;
    }
    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      resetTransform(false);
      if (deltaX > 0) goPrev();
      else goNext();
      return;
    }
    if (elapsed < TAP_MAX_MS) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width;
      resetTransform(false);
      if (relativeX < 1 / 3) goPrev();
      else if (relativeX > 2 / 3) goNext();
      else resetTransform(true);
      return;
    }
    resetTransform(true);
  }

  function handlePointerCancel() {
    pointerRef.current = null;
    setPaused(false);
    resetTransform(true);
  }

  return (
    <div
      className="relative touch-none select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {hasMultiple && (
        <div className="absolute inset-x-2 top-2 z-10 flex gap-1">
          {urls.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white" style={{ width: `${(i < index ? 1 : i === index ? progress : 0) * 100}%` }} />
            </div>
          ))}
        </div>
      )}

      <div ref={dragRef} style={{ willChange: "transform, opacity" }}>
        <img src={urls[index]} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" draggable={false} />
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ["❤️", "😍", "😂", "😮", "👏", "😢"];

/** Barre de réactions (emoji) + fil de commentaires (avec réponses de l'auteur du voyage en
 * retrait) + formulaire d'ajout, pour une publication du journal. Utilisé côté visiteurs
 * anonymes (page publique) ; côté propriétaire, voir JournalOwnerSocial dans journal-map-view.tsx. */
export function JournalPostSocial({
  reactions,
  comments,
  commentReactions,
  visitorName,
  onReact,
  onComment,
  onToggleCommentReaction,
}: {
  reactions: JournalPostReaction[];
  comments: JournalPostComment[];
  commentReactions: JournalCommentReaction[];
  visitorName: string;
  onReact: (emoji: string) => void;
  onComment: (content: string) => void;
  onToggleCommentReaction: (commentId: string) => void;
}) {
  const [commentText, setCommentText] = useState("");
  const myReaction = reactions.find((r) => r.visitor_name === visitorName)?.emoji;
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);

  const rootComments = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, JournalPostComment[]>();
  for (const c of comments) {
    if (!c.parent_comment_id) continue;
    const list = repliesByParent.get(c.parent_comment_id) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_comment_id, list);
  }

  function submitComment() {
    if (!commentText.trim()) return;
    onComment(commentText.trim());
    setCommentText("");
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {REACTION_EMOJIS.map((emoji) => {
          const count = counts.get(emoji) ?? 0;
          const active = myReaction === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-1 text-sm transition-colors",
                active ? "border-accent bg-accent/15" : "border-border/60 hover:bg-muted"
              )}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-xs text-muted-foreground">{count}</span>}
            </button>
          );
        })}
      </div>

      {rootComments.length > 0 && (
        <div className="space-y-2">
          {rootComments.map((c) => (
            <div key={c.id} className="space-y-1">
              <p className="text-sm">
                <span className="font-medium">{c.author_name}</span> <span className="whitespace-pre-wrap">{c.content}</span>
              </p>
              <CommentLikeButton
                commentId={c.id}
                reactions={commentReactions}
                visitorName={visitorName}
                onToggle={onToggleCommentReaction}
              />
              {(repliesByParent.get(c.id) ?? []).map((r) => (
                <div key={r.id} className="ml-4 space-y-1 border-l-2 border-accent/40 pl-2">
                  <p className="text-sm">
                    <span className="font-medium text-accent">{r.author_name}</span>{" "}
                    <span className="whitespace-pre-wrap">{r.content}</span>
                  </p>
                  <CommentLikeButton
                    commentId={r.id}
                    reactions={commentReactions}
                    visitorName={visitorName}
                    onToggle={onToggleCommentReaction}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitComment()}
          placeholder="Écrire un commentaire..."
          className="h-9 text-sm"
        />
        <Button type="button" size="sm" onClick={submitComment} disabled={!commentText.trim()}>
          Envoyer
        </Button>
      </div>
    </div>
  );
}

/** Petit cœur "j'aime" sous un commentaire (ou une réponse), avec compteur — réaction unique
 * (pas de choix d'emoji, contrairement aux publications) pour rester léger visuellement. */
export function CommentLikeButton({
  commentId,
  reactions,
  visitorName,
  onToggle,
}: {
  commentId: string;
  reactions: JournalCommentReaction[];
  visitorName: string;
  onToggle: (commentId: string) => void;
}) {
  const commentLikes = reactions.filter((r) => r.comment_id === commentId);
  const active = commentLikes.some((r) => r.visitor_name === visitorName);

  return (
    <button
      type="button"
      onClick={() => onToggle(commentId)}
      className={cn(
        "flex items-center gap-1 text-xs transition-colors",
        active ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"
      )}
    >
      <Heart className={cn("h-3 w-3", active && "fill-rose-500")} />
      {commentLikes.length > 0 && commentLikes.length}
    </button>
  );
}

/** Demande le prénom du visiteur une seule fois (mémorisé ensuite en localStorage), avant sa
 * première réaction ou son premier commentaire — pour que l'auteur du voyage sache qui a
 * participé. */
export function VisitorNameDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xs">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Comment vous appelez-vous ?</p>
            <p className="text-xs text-muted-foreground">Pour que les auteurs du voyage sachent qui a réagi ou commenté.</p>
          </div>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Prénom"
            onKeyDown={(e) => e.key === "Enter" && value.trim() && onConfirm(value.trim())}
          />
          <Button className="w-full" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
