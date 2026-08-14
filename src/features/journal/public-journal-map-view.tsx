import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { journalPhotoUrl } from "@/features/voyages/journal/use-journal";
import { StoryLightbox, JournalPostSocial, VisitorNameDialog } from "@/features/voyages/journal/journal-story-shared";
import { usePublicJournalSocial, useVisitorIdentity } from "@/features/voyages/journal/use-public-journal-social";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, cn } from "@/lib/utils";
import { Heart, MessageCircle, Images } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { PublicJournalEntry } from "@/types/database";

type MapStep = {
  entry: PublicJournalEntry;
  photoUrls: string[];
  location: { city: string; country: string; lat: number; lng: number };
};

function makeStepIcon(photoUrl: string | null, active: boolean) {
  const size = active ? 60 : 44;
  const ring = active ? "3px solid #38bdf8" : "2px solid rgba(255,255,255,0.85)";
  const inner = photoUrl
    ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
    : "background:#334155;display:flex;align-items:center;justify-content:center;";
  return L.divIcon({
    className: "",
    html: `<div style="${inner}width:${size}px;height:${size}px;border-radius:9999px;border:${ring};box-shadow:0 2px 10px rgba(0,0,0,0.5);transition:width .2s,height .2s"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBoundsOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || points.length === 0) return;
    didFit.current = true;
    if (points.length === 1) map.setView(points[0], 10);
    else map.fitBounds(points, { padding: [50, 50] });
  }, [points, map]);
  return null;
}

function FlyToActive({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    map.flyTo([lat, lng], Math.max(map.getZoom(), 8), { duration: 1.1 });
  }, [lat, lng, map]);
  return null;
}

/**
 * Vue "Carte" du journal public (même principe que la vue Carte côté propriétaire) : carte
 * satellite (avec les noms des principales villes alentours) avec le tracé du voyage, un marqueur
 * photo par étape localisée, et un bandeau de vignettes défilable en bas (numéro de jour
 * au-dessus) — cliquer une étape l'ouvre en plein écran façon story Instagram, avec
 * réactions/commentaires de visiteurs sous la photo. Pas de bouton "+" (lecture seule pour les
 * visiteurs, contrairement à la vue propriétaire).
 */
export function PublicJournalMapView({
  entries,
  startDate,
  token,
}: {
  entries: PublicJournalEntry[];
  startDate: string | null;
  token: string;
}) {
  const { reactions, comments, commentReactions, setReaction, removeReaction, addComment, setCommentReaction, removeCommentReaction } =
    usePublicJournalSocial(token);
  const { name: visitorName, setName: setVisitorName } = useVisitorIdentity(token);
  const [pendingAction, setPendingAction] = useState<((name: string) => void) | null>(null);

  const steps = useMemo<MapStep[]>(() => {
    return entries
      .filter((e) => e.latitude != null && e.longitude != null && e.city)
      .map((e) => ({
        entry: e,
        photoUrls: e.photo_paths.map((p) => journalPhotoUrl(p)),
        location: { city: e.city as string, country: e.country_region ?? "", lat: e.latitude as number, lng: e.longitude as number },
      }))
      .sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date) || a.entry.created_at.localeCompare(b.entry.created_at));
  }, [entries]);

  const skippedCount = entries.length - steps.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openPhotoIndex, setOpenPhotoIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActiveIndex(steps.length > 0 ? steps.length - 1 : 0);
  }, [steps.length]);

  function dayNumberFor(entryDate: string): number | null {
    return startDate ? differenceInCalendarDays(parseISO(entryDate), parseISO(startDate)) + 1 : null;
  }

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

  function handleCommentReact(commentId: string) {
    runWithIdentity((name) => {
      const mine = commentReactions.find((r) => r.comment_id === commentId && r.visitor_name === name);
      const promise = mine ? removeCommentReaction(commentId, name) : setCommentReaction(commentId, name, "❤️");
      promise.catch((err) => toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" }));
    });
  }

  function scrollToCard(index: number) {
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function selectAndOpen(index: number) {
    setActiveIndex(index);
    scrollToCard(index);
    setOpenIndex(index);
    setOpenPhotoIndex(0);
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const center = container.scrollLeft + container.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }

  function handlePhotosExhausted() {
    if (openIndex == null) return;
    if (openIndex < steps.length - 1) {
      setActiveIndex(openIndex + 1);
      setOpenIndex(openIndex + 1);
      setOpenPhotoIndex(0);
    } else {
      setOpenIndex(null);
    }
  }

  if (steps.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucun souvenir localisé pour l'instant sur ce voyage.</p>;
  }

  const activeStep = steps[activeIndex];
  const openStep = openIndex != null ? steps[openIndex] : null;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative isolate -mx-4 h-[calc(100dvh-9rem)] min-h-[500px] w-[calc(100%+2rem)] overflow-hidden border-0",
          "sm:mx-0 sm:h-[75vh] sm:min-h-[560px] sm:w-full sm:rounded-lg sm:border sm:border-border"
        )}
      >
        <MapContainer
          center={[activeStep.location.lat, activeStep.location.lng]}
          zoom={6}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
          <FitBoundsOnce points={steps.map((s) => [s.location.lat, s.location.lng] as [number, number])} />
          <FlyToActive lat={activeStep.location.lat} lng={activeStep.location.lng} />
          {steps.slice(1).map((s, i) => {
            const prev = steps[i];
            return (
              <Polyline
                key={i}
                positions={[
                  [prev.location.lat, prev.location.lng],
                  [s.location.lat, s.location.lng],
                ]}
                pathOptions={{ color: "#38bdf8", weight: 2.5, opacity: 0.85 }}
              />
            );
          })}
          {steps.map((s, i) => (
            <Marker
              key={s.entry.post_id}
              position={[s.location.lat, s.location.lng]}
              icon={makeStepIcon(s.photoUrls[0] ?? null, i === activeIndex)}
              eventHandlers={{ click: () => selectAndOpen(i) }}
            />
          ))}
        </MapContainer>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-x-0 bottom-0 z-[1000] flex snap-x snap-mandatory items-end gap-3 overflow-x-auto px-4 pb-4 pt-16"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
        >
          {steps.map((s, i) => (
            <StepCard
              key={s.entry.post_id}
              refCallback={(el) => {
                cardRefs.current[i] = el;
              }}
              step={s}
              active={i === activeIndex}
              dayNumber={dayNumberFor(s.entry.entry_date)}
              reactionCount={reactions.filter((r) => r.post_id === s.entry.post_id).length}
              commentCount={comments.filter((c) => c.post_id === s.entry.post_id).length}
              onClick={() => selectAndOpen(i)}
            />
          ))}
        </div>
      </div>

      {skippedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {skippedCount} souvenir{skippedCount > 1 ? "s" : ""} sans ville associée, non affiché{skippedCount > 1 ? "s" : ""} sur
          la carte.
        </p>
      )}

      <Dialog open={openIndex != null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-0">
          {openStep && (
            <div className="flex flex-col">
              <StoryLightbox
                urls={openStep.photoUrls}
                index={openPhotoIndex}
                onIndexChange={setOpenPhotoIndex}
                onExhausted={handlePhotosExhausted}
                onDismiss={() => setOpenIndex(null)}
              />
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{openStep.entry.author_name}</span>
                  <span className="flex items-center gap-1.5">
                    {openStep.location.country && <CountryFlag name={openStep.location.country} className="text-sm" />}
                    {openStep.location.city}
                    {openStep.location.country && `, ${openStep.location.country}`} · {formatDate(openStep.entry.entry_date)}
                  </span>
                </div>
                {openStep.entry.caption && <p className="whitespace-pre-wrap text-sm">{openStep.entry.caption}</p>}
                <JournalPostSocial
                  reactions={reactions.filter((r) => r.post_id === openStep.entry.post_id)}
                  comments={comments.filter((c) => c.post_id === openStep.entry.post_id)}
                  commentReactions={commentReactions}
                  visitorName={visitorName}
                  onReact={(emoji) => handleReact(openStep.entry.post_id, emoji)}
                  onComment={(content) => handleComment(openStep.entry.post_id, content)}
                  onToggleCommentReaction={handleCommentReact}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VisitorNameDialog open={!!pendingAction} onCancel={() => setPendingAction(null)} onConfirm={handleNameConfirm} />
    </div>
  );
}

function StepCard({
  step,
  active,
  dayNumber,
  reactionCount,
  commentCount,
  refCallback,
  onClick,
}: {
  step: MapStep;
  active: boolean;
  dayNumber: number | null;
  reactionCount: number;
  commentCount: number;
  refCallback: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}) {
  const photoUrl = step.photoUrls[0] ?? null;
  const photoCount = step.photoUrls.length;

  return (
    <div className="flex w-32 flex-shrink-0 flex-col items-center gap-1 snap-center">
      {dayNumber != null && <span className="text-[10px] font-semibold text-white/90">Jour {dayNumber}</span>}
      <button
        ref={refCallback}
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex w-32 flex-col overflow-hidden rounded-xl border-2 text-left shadow-lg transition-all",
          active ? "scale-105 border-sky-400" : "border-white/40 opacity-80"
        )}
      >
        <div className="relative h-32 w-full bg-slate-800">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">📍</div>
          )}
          {step.location.country && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-xs">
              <CountryFlag name={step.location.country} className="text-xs" />
            </span>
          )}
        </div>
        <div className="space-y-0.5 bg-black/60 p-1.5">
          <p className="truncate text-xs font-semibold text-white">{step.location.city}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/80">
            <span className="flex items-center gap-0.5">
              <Heart className="h-2.5 w-2.5" /> {reactionCount}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-2.5 w-2.5" /> {commentCount}
            </span>
            {photoCount > 1 && (
              <span className="flex items-center gap-0.5">
                <Images className="h-2.5 w-2.5" /> {photoCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
