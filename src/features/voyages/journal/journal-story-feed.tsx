import { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { Camera, Plane, TrainFront, Footprints } from "lucide-react";

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

/**
 * Vue d'ensemble légère du journal : une carte résumée par souvenir (miniatures flottantes,
 * date, ville/pays, numéro de jour du voyage), triée du plus récent (en haut) au plus ancien (en
 * bas) — l'ordre déjà renvoyé par l'API. Cliquer une carte l'agrandit pour voir toutes les
 * photos et le commentaire complet. Aucune librairie d'animation : juste un flottement CSS sur
 * les miniatures et une apparition en fondu au scroll (IntersectionObserver), pour rester léger.
 */
export function JournalStoryFeed({ entries, startDate }: { entries: StoryFeedEntry[]; startDate: string | null }) {
  const [expanded, setExpanded] = useState<StoryFeedEntry | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  return (
    <div>
      {entries.map((entry, i) => {
        const dayNumber = startDate ? differenceInCalendarDays(parseISO(entry.entry_date), parseISO(startDate)) + 1 : null;
        return (
          <div key={entry.id}>
            {i > 0 && <JournalConnector index={i} prevEntry={entries[i - 1]} entry={entry} />}
            <StoryCard entry={entry} index={i} dayNumber={dayNumber} onOpen={() => setExpanded(entry)} />
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          {lightbox && <img src={lightbox.urls[lightbox.index]} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoryCard({
  entry,
  index,
  dayNumber,
  onOpen,
}: {
  entry: StoryFeedEntry;
  index: number;
  dayNumber: number | null;
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
        "mx-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-[2rem] border border-border/40 bg-card/50 p-5 text-center backdrop-blur transition-all duration-700 ease-out hover:border-accent/50 hover:bg-card/80 hover:shadow-lg hover:shadow-accent/10",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
    >
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
          {entry.country_region && <CountryFlag name={entry.country_region} className="text-base" />}
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

const FILAMENT_COLORS = ["text-sky-400/40", "text-rose-400/40", "text-amber-400/40", "text-violet-400/40"];

/** Icône façon "mode de transport" entre deux souvenirs consécutifs, purement suggestive : avion
 * si le pays change, train si seule la ville change, pas si c'est le même endroit. */
function travelIcon(prevEntry: StoryFeedEntry, entry: StoryFeedEntry) {
  if (prevEntry.country_region && entry.country_region && prevEntry.country_region !== entry.country_region) return Plane;
  if (prevEntry.city && entry.city && prevEntry.city !== entry.city) return TrainFront;
  return Footprints;
}

/** Filaments décoratifs entre deux souvenirs consécutifs : plusieurs fils de couleurs
 * différentes, animés (défilement + léger balancement), qui donnent une continuité visuelle et
 * une impression de légèreté, plus une petite icône de transport au centre — purement décoratif
 * (aria-hidden). */
function JournalConnector({ index, prevEntry, entry }: { index: number; prevEntry: StoryFeedEntry; entry: StoryFeedEntry }) {
  const strands = [0, 1, 2];
  const Icon = travelIcon(prevEntry, entry);
  return (
    <div className="relative flex h-32 items-center justify-center sm:h-40" aria-hidden="true">
      <div className="journal-filament-sway relative h-full w-20" style={{ animationDelay: `${index * 0.6}s` }}>
        {strands.map((s) => (
          <svg
            key={s}
            width="100%"
            height="100%"
            viewBox="0 0 32 140"
            preserveAspectRatio="none"
            className={cn("absolute inset-0", FILAMENT_COLORS[(index + s) % FILAMENT_COLORS.length])}
            fill="none"
          >
            <path
              d={
                s === 0
                  ? "M16 0 C 30 24, 2 44, 16 68 C 30 92, 2 112, 16 140"
                  : s === 1
                    ? "M8 0 C 26 26, -4 48, 14 70 C 28 94, 0 114, 10 140"
                    : "M24 0 C 6 22, 34 46, 18 68 C 4 94, 32 112, 22 140"
              }
              className="journal-filament"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="1 7"
              style={{ animationDelay: `${(index + s) * 0.25}s`, animationDuration: `${2 + s * 0.6}s` }}
            />
          </svg>
        ))}
      </div>
      <div className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/90 text-muted-foreground shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}
