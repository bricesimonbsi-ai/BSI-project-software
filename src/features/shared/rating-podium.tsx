import { useState } from "react";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { Star, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectPersonRow } from "@/features/people/use-people";

export type PodiumEntry = { id: string; title: string; imageUrl: string | null; avg: number };

const PODIUM_TONE = ["border-amber-400 bg-amber-400/10", "border-slate-300 bg-slate-300/10", "border-amber-700 bg-amber-700/10"];
const PODIUM_HEIGHTS = ["h-24", "h-16", "h-12"]; // 1er, 2e, 3e
const PODIUM_ORDER = [1, 0, 2]; // affichage visuel : 2e à gauche, 1er au centre, 3e à droite

/**
 * Classement visuel top 5 d'une liste notée. `tone="best"` : estrade façon compétition (1er au
 * centre en hauteur, 2e/3e de part et d'autre), classement 1-2-3-4-5 (positions dans ce top 5).
 * `tone="worst"` : mise en forme volontairement différente (liste plate, bordure en pointillés,
 * icône de tendance à la baisse, images en niveaux de gris) pour qu'on voie immédiatement qu'il ne
 * s'agit pas d'une célébration — et numérotée par le vrai rang dans le classement complet (ex.
 * "#12" sur 15 éléments notés), pas 1-2-3 qui donnerait l'impression d'un mini-podium inversé.
 * `totalCount` (nombre total d'éléments notés, tous confondus) est requis pour calculer ce vrai
 * rang côté "worst" — entries[0] y est le pire de tous, donc de rang `totalCount`.
 */
export function PodiumBoard({
  title,
  entries,
  tone,
  totalCount,
}: {
  title: string;
  entries: PodiumEntry[];
  tone: "best" | "worst";
  totalCount?: number;
}) {
  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">Rien pour l'instant.</p>
      </div>
    );
  }

  if (tone === "worst") {
    const total = totalCount ?? entries.length;
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5" /> {title}
        </p>
        <div className="space-y-1.5 rounded-md border border-dashed border-destructive/30 bg-destructive/5 p-2">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2 rounded-md bg-card/70 p-1.5">
              <span className="w-7 flex-shrink-0 text-center text-xs font-bold text-destructive/70">#{total - i}</span>
              {entry.imageUrl ? (
                <img src={entry.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover grayscale" />
              ) : (
                <div className="h-8 w-8 flex-shrink-0 rounded bg-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{entry.title}</span>
              <span className="flex flex-shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
                <Star className="h-3 w-3 text-muted-foreground" /> {entry.avg.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 5);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="flex items-end justify-center gap-2">
        {PODIUM_ORDER.filter((i) => top3[i]).map((i) => {
          const entry = top3[i];
          return (
            <div key={entry.id} className="flex w-20 flex-col items-center gap-1">
              {entry.imageUrl ? (
                <img src={entry.imageUrl} alt="" className="h-12 w-12 rounded-full border-2 border-background object-cover shadow" />
              ) : (
                <div className="h-12 w-12 rounded-full border-2 border-background bg-muted shadow" />
              )}
              <p className="line-clamp-2 text-center text-[0.65rem] font-medium leading-tight">{entry.title}</p>
              <span className="flex items-center gap-0.5 text-xs font-semibold">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {entry.avg.toFixed(1)}
              </span>
              <div
                className={cn("flex w-full items-start justify-center rounded-t-md border-t-2 pt-1 text-sm font-bold", PODIUM_TONE[i], PODIUM_HEIGHTS[i])}
              >
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {rest.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card p-2">
              <span className="w-4 flex-shrink-0 text-center text-xs font-semibold text-muted-foreground">{i + 4}</span>
              {entry.imageUrl ? (
                <img src={entry.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
              ) : (
                <div className="h-8 w-8 flex-shrink-0 rounded bg-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
              <span className="flex flex-shrink-0 items-center gap-1 text-sm font-medium">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {entry.avg.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type PersonRatingRow = { person_id: string; itemId: string; rating: number };

/** Sélecteur par personne ayant voté (≥ 1 note) : un seul classement affiché à la fois (pas tout
 * le monde simultanément sur la même page) — on clique un avatar pour basculer vers son propre
 * top 5 / flop 5. Personnes sans aucune note omises. Classement "tous les temps", pas dupliqué par
 * année pour ne pas surcharger l'écran. */
export function PersonRankingPanels({
  people,
  ratings,
  itemsById,
}: {
  people: ProjectPersonRow[];
  ratings: PersonRatingRow[];
  itemsById: Map<string, { title: string; imageUrl: string | null }>;
}) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const ratingsByPerson = new Map<string, PersonRatingRow[]>();
  for (const r of ratings) {
    const list = ratingsByPerson.get(r.person_id) ?? [];
    list.push(r);
    ratingsByPerson.set(r.person_id, list);
  }

  const activePeople = people.filter((p) => (ratingsByPerson.get(p.person_id) ?? []).length > 0);
  if (activePeople.length === 0) return null;

  const selected = activePeople.find((p) => p.person_id === selectedPersonId) ?? activePeople[0];
  const personRatings = (ratingsByPerson.get(selected.person_id) ?? [])
    .map((r) => {
      const item = itemsById.get(r.itemId);
      return item ? { id: r.itemId, title: item.title, imageUrl: item.imageUrl, avg: r.rating } : null;
    })
    .filter((x): x is PodiumEntry => x !== null);
  const top5 = [...personRatings].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const flop5 = [...personRatings].sort((a, b) => a.avg - b.avg).slice(0, 5);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Classement par personne (tous les temps)</p>
      <div className="flex flex-wrap gap-2">
        {activePeople.map((l, i) => {
          const isSelected = l.person_id === selected.person_id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedPersonId(l.person_id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition",
                isSelected ? "border-accent bg-accent/10" : "border-border/60 text-muted-foreground hover:border-border"
              )}
            >
              <PersonAvatarBadge
                name={l.people.name}
                avatarEmoji={l.people.avatar_emoji}
                avatarConfig={l.people.avatar_config}
                personId={l.people.id}
                index={i}
                colorIndex={l.people.color_index}
                className="h-5 w-5 text-[0.6rem]"
              />
              {l.people.name}
            </button>
          );
        })}
      </div>
      <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3">
        {top5.length > 0 && (
          <div className="space-y-1">
            <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Top</p>
            <MiniRankedList entries={top5} />
          </div>
        )}
        {flop5.length > 0 && (
          <div className="space-y-1">
            <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Flop</p>
            <MiniRankedList entries={flop5} muted />
          </div>
        )}
        {top5.length === 0 && flop5.length === 0 && <p className="text-sm text-muted-foreground">Rien pour l'instant.</p>}
      </div>
    </div>
  );
}

function MiniRankedList({ entries, muted = false }: { entries: PodiumEntry[]; muted?: boolean }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-1.5 text-xs">
          <span className={cn("min-w-0 flex-1 truncate", muted && "text-muted-foreground")}>{entry.title}</span>
          <span className="flex flex-shrink-0 items-center gap-0.5 font-medium">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {entry.avg.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
