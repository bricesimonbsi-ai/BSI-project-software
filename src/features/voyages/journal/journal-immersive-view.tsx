import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/** Forme normalisée d'un souvenir, commune aux deux surfaces du Journal (privé et partage
 * public) — chacune adapte ses propres données vers cette forme avant de les passer ici. */
export type ImmersivePost = {
  id: string;
  caption: string | null;
  entry_date: string;
  author_name: string;
  city: string | null;
  country_region: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_urls: string[];
};

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="background:hsl(var(--accent));color:white;border-radius:9999px;width:1.75rem;height:1.75rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid white"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Anime la caméra Leaflet vers la position courante à chaque changement (survole le globe façon
 * "fil de voyage" plutôt que de sauter directement d'un point à l'autre). */
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 9, { duration: 1.6 });
  }, [map, lat, lng]);
  return null;
}

/** Vue plein écran façon "stories" : parcourt les souvenirs un par un (chronologique, du plus
 * ancien au plus récent) avec une carte qui se déplace visuellement vers chaque nouveau lieu. */
export function JournalImmersiveView({ posts, open, onOpenChange }: { posts: ImmersivePost[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const ordered = useMemo(() => [...posts].sort((a, b) => a.entry_date.localeCompare(b.entry_date)), [posts]);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const current = ordered[index];

  // Report en avant sur le dernier lieu connu si le souvenir courant n'a pas de ville rattachée,
  // pour que la carte ne saute pas à une position par défaut entre deux publications localisées.
  const location = useMemo(() => {
    for (let i = index; i >= 0; i--) {
      const p = ordered[i];
      if (p?.latitude != null && p?.longitude != null) return { lat: p.latitude, lng: p.longitude };
    }
    return null;
  }, [ordered, index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, ordered.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ordered.length, onOpenChange]);

  if (ordered.length === 0) return null;

  const canPrev = index > 0;
  const canNext = index < ordered.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-full gap-0 overflow-hidden border-none bg-background p-0 [&>button:last-child]:hidden sm:h-[90vh] sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl">
        <div
          className="relative flex h-full flex-col"
          onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX.current == null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (delta < -50 && canNext) setIndex((i) => i + 1);
            if (delta > 50 && canPrev) setIndex((i) => i - 1);
            touchStartX.current = null;
          }}
        >
          <div className="absolute inset-x-0 top-0 z-[1001] flex items-center gap-2 p-3">
            <div className="flex flex-1 gap-1">
              {ordered.map((p, i) => (
                <div key={p.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div className={cn("h-full rounded-full bg-white transition-all", i <= index ? "w-full" : "w-0")} />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-white hover:bg-white/20 hover:text-white" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative flex-1 overflow-hidden bg-muted">
            {location ? (
              <MapContainer center={[location.lat, location.lng]} zoom={9} zoomControl={false} attributionControl={false} scrollWheelZoom={false} dragging={false} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[location.lat, location.lng]} icon={pinIcon()} />
                <FlyTo lat={location.lat} lng={location.lng} />
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune localisation pour ce souvenir</div>
            )}

            {canPrev && (
              <button
                type="button"
                aria-label="Souvenir précédent"
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-0 top-0 z-[1000] flex h-full w-14 items-center justify-start pl-1 text-white/70 hover:text-white sm:w-16"
              >
                <ChevronLeft className="h-8 w-8 drop-shadow" />
              </button>
            )}
            {canNext && (
              <button
                type="button"
                aria-label="Souvenir suivant"
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-0 top-0 z-[1000] flex h-full w-14 items-center justify-end pr-1 text-white/70 hover:text-white sm:w-16"
              >
                <ChevronRight className="h-8 w-8 drop-shadow" />
              </button>
            )}
          </div>

          <div key={current.id} className="journal-story-content max-h-[45%] flex-shrink-0 space-y-3 overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{current.author_name}</span>
              <span className="flex items-center gap-2">
                {current.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {current.city}
                  </span>
                )}
                {formatDate(current.entry_date)}
              </span>
            </div>
            {current.photo_urls.length > 0 && <PhotoCollage urls={current.photo_urls} />}
            {current.caption && <p className="whitespace-pre-wrap text-sm">{current.caption}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
