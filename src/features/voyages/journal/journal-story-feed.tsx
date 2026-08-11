import { useEffect, useRef, useState, type PointerEvent } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePublicJournalSocial, useVisitorIdentity } from "@/features/voyages/journal/use-public-journal-social";
import { toast } from "@/hooks/use-toast";
import { formatDate, cn } from "@/lib/utils";
import { Camera } from "lucide-react";
import type { JournalPostComment, JournalPostReaction } from "@/types/database";

/** Forme normalisée d'un souvenir pour cette vue, commune au journal privé et à la page publique. */
export type StoryFeedEntry = {
  id: string;
  caption: string | null;
  entry_date: string;
  author_name: string;
  city: string | null;
  country_region: string | null;
  photo_urls: string[];
};

const TRAVEL_MOTIFS = ["✈️", "🧭", "🗺️", "🧳", "🌍", "📸"];

/** Suit, dans le navigateur du visiteur (localStorage, clé par lien de partage), quels souvenirs
 * ont déjà été vus lors d'une visite précédente — jamais rien envoyé au serveur, purement local.
 * Le calcul est figé au chargement : les souvenirs déjà là restent marqués "déjà vus" pendant
 * toute la visite (pas de disparition du badge pendant qu'on regarde), et la liste est mise à
 * jour pour la prochaine visite. */
function useSeenTracking(storageKey: string | undefined, ids: string[]) {
  const [seenBefore, setSeenBefore] = useState<Set<string>>(new Set());
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!storageKey || !idsKey) return;
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      stored = [];
    }
    setSeenBefore(new Set(stored));
    try {
      localStorage.setItem(storageKey, JSON.stringify([...new Set([...stored, ...idsKey.split(",")])]));
    } catch {
      // stockage indisponible (navigation privée, quota...) : tant pis, pas de suivi cette fois
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, idsKey]);

  return seenBefore;
}

/**
 * Vue d'ensemble légère du journal : une carte résumée par souvenir (miniatures flottantes,
 * date, ville/pays, numéro de jour du voyage), triée du plus récent (en haut) au plus ancien (en
 * bas) — l'ordre déjà renvoyé par l'API. Cliquer une carte l'agrandit pour voir toutes les
 * photos, le commentaire complet, réagir et commenter. `shareToken` (optionnel) active le repère
 * "déjà vu / nouveau" ainsi que les réactions/commentaires pour les visiteurs anonymes de la page
 * publique.
 */
export function JournalStoryFeed({
  entries,
  startDate,
  shareToken,
}: {
  entries: StoryFeedEntry[];
  startDate: string | null;
  shareToken?: string;
}) {
  const [expanded, setExpanded] = useState<StoryFeedEntry | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const seenBefore = useSeenTracking(
    shareToken ? `journal-seen-${shareToken}` : undefined,
    entries.map((e) => e.id)
  );
  const { name: visitorName, setName: setVisitorName } = useVisitorIdentity(shareToken);
  const { reactions, comments, setReaction, removeReaction, addComment } = usePublicJournalSocial(shareToken);
  const [pendingAction, setPendingAction] = useState<((name: string) => void) | null>(null);

  function runWithIdentity(action: (name: string) => void) {
    if (visitorName) action(visitorName);
    else setPendingAction(() => action);
  }

  function handleNameConfirm(name: string) {
    setVisitorName(name);
    const action = pendingAction;
    setPendingAction(null);
    action?.(name);
  }

  function handleReact(postId: string, emoji: string) {
    runWithIdentity((name) => {
      const mine = reactions.find((r) => r.post_id === postId && r.visitor_name === name);
      const promise = mine?.emoji === emoji ? removeReaction(postId, name) : setReaction(postId, name, emoji);
      promise.catch((err) => toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" }));
    });
  }

  function handleComment(postId: string, content: string) {
    runWithIdentity((name) => {
      addComment(postId, name, content).catch((err) =>
        toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" })
      );
    });
  }

  return (
    <div className="relative">
      <JourneyFilaments />
      <JourneyMotifs count={entries.length} />

      {entries.map((entry, i) => {
        const dayNumber = startDate ? differenceInCalendarDays(parseISO(entry.entry_date), parseISO(startDate)) + 1 : null;
        return (
          <div key={entry.id} className={i > 0 ? "mt-20 sm:mt-32" : undefined}>
            <StoryCard
              entry={entry}
              index={i}
              dayNumber={dayNumber}
              isNew={!!shareToken && !seenBefore.has(entry.id)}
              onOpen={() => setExpanded(entry)}
            />
          </div>
        );
      })}

      <Dialog open={!!expanded} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {expanded && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{expanded.author_name}</span>
                <span className="flex items-center gap-2">
                  {expanded.city && (
                    <span className="flex items-center gap-1">
                      {expanded.country_region && <CountryFlag name={expanded.country_region} className="text-sm" />}
                      {expanded.city}
                      {expanded.country_region && `, ${expanded.country_region}`}
                    </span>
                  )}
                  {formatDate(expanded.entry_date)}
                </span>
              </div>
              {expanded.photo_urls.length > 0 && (
                <PhotoCollage
                  urls={expanded.photo_urls}
                  onPhotoClick={(idx) => setLightbox({ urls: expanded.photo_urls, index: idx })}
                />
              )}
              {expanded.caption && <p className="whitespace-pre-wrap text-sm">{expanded.caption}</p>}
              {shareToken && (
                <JournalPostSocial
                  reactions={reactions.filter((r) => r.post_id === expanded.id)}
                  comments={comments.filter((c) => c.post_id === expanded.id)}
                  visitorName={visitorName}
                  onReact={(emoji) => handleReact(expanded.id, emoji)}
                  onComment={(content) => handleComment(expanded.id, content)}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VisitorNameDialog open={!!pendingAction} onCancel={() => setPendingAction(null)} onConfirm={handleNameConfirm} />

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          {lightbox && (
            <StoryLightbox
              urls={lightbox.urls}
              index={lightbox.index}
              onIndexChange={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
              onClose={() => setLightbox(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LIGHTBOX_AUTO_ADVANCE_MS = 4000;
const TAP_MAX_MS = 300;
const SWIPE_THRESHOLD_PX = 50;

/** Visionneuse façon "story" : défilement automatique après un temps limité, navigation par
 * appui sur les côtés gauche/droite de la photo ou par glissement (swipe), et rester appuyé
 * (n'importe où sur la photo) met le défilement en pause tant qu'on ne relâche pas — comme sur
 * Instagram. Une seule gestion pointer unifiée (souris + tactile) pilote les trois. */
function StoryLightbox({
  urls,
  index,
  onIndexChange,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const hasMultiple = urls.length > 1;
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; time: number } | null>(null);

  function goPrev() {
    if (index > 0) onIndexChange(index - 1);
  }

  function goNext() {
    if (index < urls.length - 1) onIndexChange(index + 1);
    else onClose();
  }

  useEffect(() => {
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
    pointerRef.current = { x: e.clientX, time: Date.now() };
    if (hasMultiple) setPaused(true);
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = pointerRef.current;
    pointerRef.current = null;
    setPaused(false);
    if (!hasMultiple || !start) return;
    const deltaX = e.clientX - start.x;
    const elapsed = Date.now() - start.time;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      if (deltaX > 0) goPrev();
      else goNext();
      return;
    }
    if (elapsed < TAP_MAX_MS) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width;
      if (relativeX < 1 / 3) goPrev();
      else if (relativeX > 2 / 3) goNext();
    }
  }

  function handlePointerCancel() {
    pointerRef.current = null;
    setPaused(false);
  }

  return (
    <div
      className="relative touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
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

      <img src={urls[index]} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" draggable={false} />
    </div>
  );
}

const REACTION_EMOJIS = ["❤️", "😍", "😂", "😮", "👏", "😢"];

/** Barre de réactions (emoji) + fil de commentaires (avec réponses de l'auteur du voyage en
 * retrait) + formulaire d'ajout, pour une publication du journal public. */
function JournalPostSocial({
  reactions,
  comments,
  visitorName,
  onReact,
  onComment,
}: {
  reactions: JournalPostReaction[];
  comments: JournalPostComment[];
  visitorName: string;
  onReact: (emoji: string) => void;
  onComment: (content: string) => void;
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
              {(repliesByParent.get(c.id) ?? []).map((r) => (
                <p key={r.id} className="ml-4 border-l-2 border-accent/40 pl-2 text-sm">
                  <span className="font-medium text-accent">{r.author_name}</span>{" "}
                  <span className="whitespace-pre-wrap">{r.content}</span>
                </p>
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

/** Demande le prénom du visiteur une seule fois (mémorisé ensuite en localStorage), avant sa
 * première réaction ou son premier commentaire — pour que l'auteur du voyage sache qui a
 * participé. */
function VisitorNameDialog({
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

function StoryCard({
  entry,
  index,
  dayNumber,
  isNew,
  onOpen,
}: {
  entry: StoryFeedEntry;
  index: number;
  dayNumber: number | null;
  isNew: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const thumbs = entry.photo_urls.slice(0, 3);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className={cn(
        "relative mx-auto flex w-full max-w-xs flex-col items-center gap-3 p-2 text-center transition-all duration-700 ease-out hover:opacity-80",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
    >
      {isNew && (
        <span className="absolute right-6 top-0 flex h-2.5 w-2.5" title="Nouveau">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
      )}

      <div className="flex items-center justify-center">
        {thumbs.length === 0 ? (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Camera className="h-6 w-6" />
          </div>
        ) : (
          thumbs.map((url, i) => (
            <img
              key={url}
              src={url}
              alt=""
              className={cn(
                "journal-thumb-float h-20 w-20 rounded-full border-2 border-background object-cover shadow-md",
                i > 0 && "-ml-6"
              )}
              style={{
                zIndex: thumbs.length - i,
                animationDelay: `${(index * 3 + i) * 0.35}s`,
              }}
            />
          ))
        )}
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm font-semibold">{entry.city ?? "Souvenir"}</span>
          {entry.country_region && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CountryFlag name={entry.country_region} className="text-base" />
              {entry.country_region}
            </span>
          )}
          {dayNumber != null && (
            <Badge variant="secondary" className="text-[10px]">
              Jour {dayNumber}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(entry.entry_date)}</p>
      </div>
    </button>
  );
}

const FILAMENT_LANES = [
  { left: "6%", color: "text-sky-400/25" },
  { left: "90%", color: "text-rose-400/25" },
  { left: "20%", color: "text-violet-400/20" },
  { left: "78%", color: "text-amber-400/20" },
  { left: "50%", color: "text-teal-400/15" },
];

/** Un long filament vertical ondulé, se répétant sur toute la hauteur — le viewBox est
 * volontairement grand (1200) et étiré (preserveAspectRatio="none") pour couvrir n'importe
 * quelle longueur de fil sans dépendre du nombre de souvenirs. */
function filamentPath(seed: number) {
  const amp = 8 + (seed % 3) * 5;
  const periods = 10;
  const periodHeight = 1200 / periods;
  const points = [`M 20 0`];
  for (let i = 0; i < periods; i++) {
    const yMid = i * periodHeight + periodHeight * 0.5;
    const yEnd = (i + 1) * periodHeight;
    const dir = (i + seed) % 2 === 0 ? 1 : -1;
    points.push(`C ${20 + dir * amp} ${yMid}, ${20 - dir * amp} ${yMid}, 20 ${yEnd}`);
  }
  return points.join(" ");
}

/** Longs filaments décoratifs répartis à la verticale sur toute la vue (pas alignés sur les
 * souvenirs), plusieurs couleurs, animés (défilement + léger balancement) — purement décoratif
 * (aria-hidden), au même titre que JourneyMotifs. */
function JourneyFilaments() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {FILAMENT_LANES.map((lane, i) => (
        <div key={i} className="journal-filament-sway absolute top-0 h-full w-10" style={{ left: lane.left, animationDelay: `${i * 0.7}s` }}>
          <svg width="100%" height="100%" viewBox="0 0 40 1200" preserveAspectRatio="none" className={lane.color} fill="none">
            <path
              d={filamentPath(i)}
              className="journal-filament"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="1 9"
              style={{ animationDelay: `${i * 0.4}s`, animationDuration: `${3 + i * 0.5}s` }}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

/** Motifs décoratifs façon "thème voyage" (avion, boussole, carte...) répartis en filigrane sur
 * toute la hauteur du fil, façon ThemeMotifBackground mais localisés à cette vue — purement
 * décoratif, discrets, pas alignés sur les souvenirs (aria-hidden). */
function JourneyMotifs({ count }: { count: number }) {
  const motifCount = Math.max(4, Math.ceil(count / 1.2));
  const slots = Array.from({ length: motifCount }, (_, i) => ({
    top: ((i + 0.5) / motifCount) * 100,
    side: i % 2 === 0 ? "left" : "right",
    offset: 2 + ((i * 37) % 12),
    size: 1.4 + ((i * 13) % 10) / 10,
    rotate: ((i * 53) % 28) - 14,
    delay: `${(i * 0.9) % 6}s`,
    emoji: TRAVEL_MOTIFS[i % TRAVEL_MOTIFS.length],
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {slots.map((s, i) => (
        <span
          key={i}
          className="theme-motif absolute select-none opacity-[0.09] dark:opacity-[0.14]"
          style={{
            top: `${s.top}%`,
            [s.side]: `${s.offset}%`,
            fontSize: `${s.size}rem`,
            rotate: `${s.rotate}deg`,
            animationDelay: s.delay,
          }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}
