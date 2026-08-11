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
 * photos et le commentaire complet. `storageKey` (optionnel, ex. le token de partage) active le
 * repère "déjà vu / nouveau" pour les visiteurs anonymes de la page publique.
 */
export function JournalStoryFeed({
  entries,
  startDate,
  storageKey,
}: {
  entries: StoryFeedEntry[];
  startDate: string | null;
  storageKey?: string;
}) {
  const [expanded, setExpanded] = useState<StoryFeedEntry | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const seenBefore = useSeenTracking(
    storageKey,
    entries.map((e) => e.id)
  );

  return (
    <div className="relative">
      <JourneyFilaments />
      <JourneyMotifs count={entries.length} />

      {entries.map((entry, i) => {
        const dayNumber = startDate ? differenceInCalendarDays(parseISO(entry.entry_date), parseISO(startDate)) + 1 : null;
        return (
          <div key={entry.id} className={i > 0 ? "mt-10 sm:mt-14" : undefined}>
            <StoryCard
              entry={entry}
              index={i}
              dayNumber={dayNumber}
              isNew={!!storageKey && !seenBefore.has(entry.id)}
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
