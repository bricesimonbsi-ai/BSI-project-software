import { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { PhotoCollage } from "@/features/voyages/journal/photo-collage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { Camera } from "lucide-react";

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
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const dayNumber = startDate ? differenceInCalendarDays(parseISO(entry.entry_date), parseISO(startDate)) + 1 : null;
        return <StoryCard key={entry.id} entry={entry} index={i} dayNumber={dayNumber} onOpen={() => setExpanded(entry)} />;
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
        "flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-card/70 p-3 text-left backdrop-blur transition-all duration-700 ease-out hover:border-accent/50 hover:bg-card hover:shadow-lg hover:shadow-accent/10",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
    >
      <div className="relative h-16 w-20 flex-shrink-0 sm:h-20 sm:w-24">
        {thumbs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Camera className="h-5 w-5" />
          </div>
        ) : (
          thumbs.map((url, i) => (
            <img
              key={url}
              src={url}
              alt=""
              className="journal-thumb-float absolute h-14 w-14 rounded-xl border-2 border-background object-cover shadow-md sm:h-16 sm:w-16"
              style={{
                left: i * 12,
                top: i * 5,
                zIndex: thumbs.length - i,
                transform: `rotate(${(i - 1) * 7}deg)`,
                animationDelay: `${(index * 3 + i) * 0.35}s`,
              }}
            />
          ))
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{entry.city ?? "Souvenir"}</span>
          {entry.country_region && <CountryFlag name={entry.country_region} className="text-base" />}
          {dayNumber != null && (
            <Badge variant="secondary" className="text-[10px]">
              Jour {dayNumber}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(entry.entry_date)}</p>
        {entry.caption && <p className="truncate text-xs text-muted-foreground">{entry.caption}</p>}
      </div>
    </button>
  );
}
