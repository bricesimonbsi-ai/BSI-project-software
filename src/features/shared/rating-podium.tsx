import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectPersonRow } from "@/features/people/use-people";

export type PodiumEntry = { id: string; title: string; imageUrl: string | null; avg: number };

const PODIUM_TONE = {
  best: ["border-amber-400 bg-amber-400/10", "border-slate-300 bg-slate-300/10", "border-amber-700 bg-amber-700/10"],
  worst: ["border-border bg-muted/40", "border-border bg-muted/30", "border-border bg-muted/20"],
} as const;
const PODIUM_HEIGHTS = ["h-24", "h-16", "h-12"]; // 1er, 2e, 3e
const PODIUM_ORDER = [1, 0, 2]; // affichage visuel : 2e à gauche, 1er au centre, 3e à droite

/** Podium visuel (estrade) pour le top 3 d'un classement, façon compétition — 1er au centre en
 * hauteur, 2e/3e de part et d'autre — puis 4e/5e en liste compacte en-dessous. `tone="worst"` pour
 * les moins bien notés : pas de couleurs "médaille", teinte neutre. */
export function PodiumBoard({ title, entries, tone }: { title: string; entries: PodiumEntry[]; tone: "best" | "worst" }) {
  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">Rien pour l'instant.</p>
      </div>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 5);
  const tones = PODIUM_TONE[tone];

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
                className={cn("flex w-full items-start justify-center rounded-t-md border-t-2 pt-1 text-sm font-bold", tones[i], PODIUM_HEIGHTS[i])}
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

/** Un volet repliable par personne ayant voté (≥ 1 note), avec son propre top 5 / flop 5 —
 * personnes sans aucune note omises. Classement "tous les temps", pas dupliqué par année pour ne
 * pas surcharger l'écran. */
export function PersonRankingPanels({
  people,
  ratings,
  itemsById,
}: {
  people: ProjectPersonRow[];
  ratings: PersonRatingRow[];
  itemsById: Map<string, { title: string; imageUrl: string | null }>;
}) {
  const ratingsByPerson = new Map<string, PersonRatingRow[]>();
  for (const r of ratings) {
    const list = ratingsByPerson.get(r.person_id) ?? [];
    list.push(r);
    ratingsByPerson.set(r.person_id, list);
  }

  const activePeople = people.filter((p) => (ratingsByPerson.get(p.person_id) ?? []).length > 0);
  if (activePeople.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Classement par personne (tous les temps)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {activePeople.map((l, i) => {
          const personRatings = (ratingsByPerson.get(l.person_id) ?? [])
            .map((r) => {
              const item = itemsById.get(r.itemId);
              return item ? { id: r.itemId, title: item.title, imageUrl: item.imageUrl, avg: r.rating } : null;
            })
            .filter((x): x is PodiumEntry => x !== null);
          const top5 = [...personRatings].sort((a, b) => b.avg - a.avg).slice(0, 5);
          const flop5 = [...personRatings].sort((a, b) => a.avg - b.avg).slice(0, 5);

          return (
            <div key={l.id} className="space-y-2 rounded-lg border border-border/60 bg-card p-3">
              <div className="flex items-center gap-2">
                <PersonAvatarBadge
                  name={l.people.name}
                  avatarEmoji={l.people.avatar_emoji}
                  avatarConfig={l.people.avatar_config}
                  personId={l.people.id}
                  index={i}
                  className="h-6 w-6 text-xs"
                />
                <span className="text-sm font-medium">{l.people.name}</span>
              </div>
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
            </div>
          );
        })}
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
