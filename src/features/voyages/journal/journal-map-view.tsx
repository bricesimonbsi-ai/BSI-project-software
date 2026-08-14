import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  useJournalPosts,
  useJournalSocial,
  useReplyToComment,
  useSetOwnerCommentReaction,
  useRemoveOwnerCommentReaction,
  journalPhotoUrl,
  type JournalPostWithPhotos,
} from "@/features/voyages/journal/use-journal";
import { JournalOwnerSocial } from "@/features/voyages/journal/journal-timeline";
import { StoryLightbox } from "@/features/voyages/journal/journal-story-feed";
import { JournalPostComposer } from "@/features/voyages/journal/journal-post-composer";
import { useAuth } from "@/app/providers/auth-provider";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, cn } from "@/lib/utils";
import { Heart, MessageCircle, Images, Plus } from "lucide-react";

type MapStep = {
  post: JournalPostWithPhotos;
  location: { city: string; country: string; lat: number; lng: number };
};

function makeStepIcon(photoUrl: string | null, active: boolean) {
  const size = active ? 60 : 44;
  const ring = active ? "3px solid #38bdf8" : "2px solid rgba(255,255,255,0.85)";
  const inner = photoUrl
    ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
    : `background:#334155;display:flex;align-items:center;justify-content:center;font-size:${size / 2}px;`;
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
 * Vue "Carte" du journal (façon Polarsteps) : une carte satellite avec le tracé du voyage entre
 * les souvenirs localisés, un marqueur photo circulaire par étape, et un bandeau de vignettes
 * défilable horizontalement en bas — la carte se recentre sur l'étape active (sélection ou
 * défilement du bandeau). Cliquer une étape (vignette ou marqueur) l'ouvre en plein écran façon
 * story Instagram, avec le commentaire et les réactions sous la photo ; swiper au-delà de la
 * dernière photo enchaîne automatiquement sur l'étape suivante.
 */
export function JournalMapView({ voyageId }: { voyageId: string }) {
  const { data: posts, isLoading } = useJournalPosts(voyageId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: sousEtapes } = useVoyageSousEtapes(voyageId);
  const postIds = useMemo(() => (posts ?? []).map((p) => p.id), [posts]);
  const { data: social } = useJournalSocial(voyageId, postIds);
  const replyToComment = useReplyToComment(voyageId);
  const setOwnerCommentReaction = useSetOwnerCommentReaction(voyageId);
  const removeOwnerCommentReaction = useRemoveOwnerCommentReaction(voyageId);
  const { profile, session } = useAuth();
  const ownerName = profile?.display_name || session?.user.email || "Vous";

  const locationBySousEtape = useMemo(() => {
    const etapeById = new Map((etapes ?? []).map((e) => [e.id, e]));
    const map = new Map<string, { city: string; country: string; lat: number; lng: number }>();
    for (const se of sousEtapes ?? []) {
      if (se.latitude == null || se.longitude == null) continue;
      const etape = etapeById.get(se.etape_id);
      if (etape) map.set(se.id, { city: se.city, country: etape.country_region, lat: se.latitude, lng: se.longitude });
    }
    return map;
  }, [etapes, sousEtapes]);

  const steps = useMemo<MapStep[]>(() => {
    return (posts ?? [])
      .filter((p) => p.sous_etape_id && locationBySousEtape.has(p.sous_etape_id))
      .map((p) => ({ post: p, location: locationBySousEtape.get(p.sous_etape_id as string)! }))
      .sort((a, b) => a.post.entry_date.localeCompare(b.post.entry_date) || a.post.created_at.localeCompare(b.post.created_at));
  }, [posts, locationBySousEtape]);

  const skippedCount = (posts?.length ?? 0) - steps.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openPhotoIndex, setOpenPhotoIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActiveIndex(steps.length > 0 ? steps.length - 1 : 0);
  }, [steps.length]);

  function handleToggleCommentReaction(commentId: string) {
    const mine = (social?.commentReactions ?? []).find((r) => r.comment_id === commentId && r.visitor_name === ownerName);
    if (mine) removeOwnerCommentReaction.mutate(commentId);
    else setOwnerCommentReaction.mutate({ commentId, emoji: "❤️" });
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun souvenir localisé pour l'instant — ajoute-en un avec une ville associée pour le voir apparaître ici.
        </p>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-accent/60 text-accent transition-colors hover:bg-accent/10"
          title="Ajouter un souvenir"
        >
          <Plus className="h-5 w-5" />
        </button>
        <ComposerDialog voyageId={voyageId} open={composerOpen} onOpenChange={setComposerOpen} />
      </div>
    );
  }

  const activeStep = steps[activeIndex];
  const openStep = openIndex != null ? steps[openIndex] : null;
  const openUrls = openStep ? openStep.post.voyage_journal_photos.map((p) => journalPhotoUrl(p.storage_path)) : [];

  return (
    <div className="space-y-2">
      <div className="relative isolate h-[75vh] min-h-[560px] overflow-hidden rounded-lg border border-border">
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
          {steps.map((s, i) => {
            const photoUrl = s.post.voyage_journal_photos[0] ? journalPhotoUrl(s.post.voyage_journal_photos[0].storage_path) : null;
            return (
              <Marker
                key={s.post.id}
                position={[s.location.lat, s.location.lng]}
                icon={makeStepIcon(photoUrl, i === activeIndex)}
                eventHandlers={{ click: () => selectAndOpen(i) }}
              />
            );
          })}
        </MapContainer>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-x-0 bottom-0 z-[1000] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-16"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
        >
          <AddStepButton onClick={() => setComposerOpen(true)} />
          {steps.map((s, i) => (
            <Fragment key={s.post.id}>
              <StepCard
                refCallback={(el) => {
                  cardRefs.current[i] = el;
                }}
                step={s}
                active={i === activeIndex}
                reactionCount={(social?.reactions ?? []).filter((r) => r.post_id === s.post.id).length}
                commentCount={(social?.comments ?? []).filter((c) => c.post_id === s.post.id).length}
                onClick={() => selectAndOpen(i)}
              />
              <AddStepButton onClick={() => setComposerOpen(true)} />
            </Fragment>
          ))}
        </div>
      </div>

      <ComposerDialog voyageId={voyageId} open={composerOpen} onOpenChange={setComposerOpen} />

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
              <StoryLightbox urls={openUrls} index={openPhotoIndex} onIndexChange={setOpenPhotoIndex} onClose={handlePhotosExhausted} />
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{openStep.post.author_name}</span>
                  <span className="flex items-center gap-1.5">
                    <CountryFlag name={openStep.location.country} className="text-sm" />
                    {openStep.location.city}, {openStep.location.country} · {formatDate(openStep.post.entry_date)}
                  </span>
                </div>
                {openStep.post.caption && <p className="whitespace-pre-wrap text-sm">{openStep.post.caption}</p>}
                <JournalOwnerSocial
                  reactions={(social?.reactions ?? []).filter((r) => r.post_id === openStep.post.id)}
                  comments={(social?.comments ?? []).filter((c) => c.post_id === openStep.post.id)}
                  commentReactions={social?.commentReactions ?? []}
                  visitorName={ownerName}
                  onReply={(commentId, content) => replyToComment.mutate({ postId: openStep.post.id, parentCommentId: commentId, content })}
                  onToggleCommentReaction={handleToggleCommentReaction}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bouton "+" pour insérer un souvenir avant/entre/après les étapes du bandeau — ouvre le
 * composeur habituel dans une fenêtre, sans présélectionner de position (l'ordre est de toute
 * façon recalculé automatiquement, chronologique par date de souvenir). */
function AddStepButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ajouter un souvenir"
      className="flex w-10 flex-shrink-0 snap-center items-center justify-center self-center rounded-full border-2 border-dashed border-white/50 bg-black/30 text-white/80 transition-colors hover:border-accent hover:bg-accent/20 hover:text-accent"
      style={{ height: "8rem" }}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}

function ComposerDialog({
  voyageId,
  open,
  onOpenChange,
}: {
  voyageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau souvenir</DialogTitle>
        </DialogHeader>
        <JournalPostComposer voyageId={voyageId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function StepCard({
  step,
  active,
  reactionCount,
  commentCount,
  refCallback,
  onClick,
}: {
  step: MapStep;
  active: boolean;
  reactionCount: number;
  commentCount: number;
  refCallback: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}) {
  const photoUrl = step.post.voyage_journal_photos[0] ? journalPhotoUrl(step.post.voyage_journal_photos[0].storage_path) : null;
  const photoCount = step.post.voyage_journal_photos.length;

  return (
    <button
      ref={refCallback}
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-32 flex-shrink-0 snap-center flex-col overflow-hidden rounded-xl border-2 text-left shadow-lg transition-all",
        active ? "scale-105 border-sky-400" : "border-white/40 opacity-80"
      )}
    >
      <div className="relative h-32 w-full bg-slate-800">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">📍</div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-xs">
          <CountryFlag name={step.location.country} className="text-xs" />
        </span>
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
  );
}
