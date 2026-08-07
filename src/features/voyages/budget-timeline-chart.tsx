import { useMemo, useRef, useState, type MouseEvent } from "react";
import { consumedPct, ConsumedPctBadge } from "@/features/voyages/category-comparison-chart";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { TimelinePoint } from "@/features/voyages/budget-timeline";

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;
/** Distance minimale (en unités du viewBox) entre deux étiquettes de date pour éviter qu'elles se
 * chevauchent — sert à la fois à border "Aujourd'hui" près d'une extrémité et à masquer une
 * graduation intermédiaire trop proche d'"Aujourd'hui". */
const LABEL_CLEARANCE = 42;

/** Arrondit l'échelle à un multiple "propre" (1/2/5 x 10^n) pour des graduations lisibles. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(dateStr));
}

/**
 * Courbe "prévisionnel cumulé selon l'itinéraire planifié" (pointillé) vs "réel cumulé"
 * (plein, aire) — répond à "au jour J, ai-je plus ou moins dépensé que prévu POUR CE STADE du
 * voyage", une question différente du % de consommation global (réel / budget total final)
 * déjà affiché au-dessus : ce dernier ne dit rien du rythme, seulement de l'avancement global.
 * L'encart sous le graphique relie explicitement les deux via la même pastille colorée.
 *
 * Le conteneur impose le même ratio largeur/hauteur que le viewBox (`aspectRatio` + `preserve-
 * AspectRatio="none"`) : sans ça, le SVG peut être étiré/letterboxé différemment de sa grille
 * interne et la position du curseur de survol calculée depuis `getBoundingClientRect()` dérive
 * de la position réelle de la souris.
 */
export function BudgetTimelineChart({
  points,
  todayDate,
  currency,
}: {
  points: TimelinePoint[];
  todayDate: string;
  currency: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const maxValue = useMemo(() => niceMax(Math.max(1, ...points.map((p) => Math.max(p.plannedCumulative, p.actualCumulative)))), [points]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Itinéraire pas encore renseigné : impossible de calculer une chronologie.</p>;
  }

  const lastIndex = points.length - 1;
  const x = (i: number) => PAD_LEFT + (lastIndex === 0 ? 0 : (i / lastIndex) * PLOT_W);
  const y = (v: number) => PAD_TOP + PLOT_H - (Math.min(v, maxValue) / maxValue) * PLOT_H;

  const plannedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.plannedCumulative)}`).join(" ");
  const actualPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.actualCumulative)}`).join(" ");
  const actualAreaPath = `${actualPath} L${x(lastIndex)},${PAD_TOP + PLOT_H} L${x(0)},${PAD_TOP + PLOT_H} Z`;

  const clampedToday = todayDate < points[0].date ? points[0].date : todayDate > points[lastIndex].date ? points[lastIndex].date : todayDate;
  const todayIndex = points.findIndex((p) => p.date === clampedToday);
  const beforeTrip = todayDate < points[0].date;
  const afterTrip = todayDate > points[lastIndex].date;

  const activeIndex = hoverIndex ?? (todayIndex === -1 ? lastIndex : todayIndex);
  const active = points[activeIndex];
  const activePct = consumedPct(active.actualCumulative, active.plannedCumulative);

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // Position de la souris en unités du viewBox, PUIS ramenée à une fraction de la zone de
    // tracé (entre PAD_LEFT et VIEW_W-PAD_RIGHT) — pas de la largeur totale du SVG, qui inclut
    // les marges des axes : les ignorer causait un décalage croissant vers les bords (jusqu'à
    // PAD_LEFT ≈ 9% de la largeur near le bord gauche), le repère de survol dérivant de la souris.
    const svgX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const relX = Math.min(1, Math.max(0, (svgX - PAD_LEFT) / PLOT_W));
    setHoverIndex(Math.round(relX * lastIndex));
  }

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  // Dates intermédiaires en abscisse, proportionnelles à la durée du voyage (chaque point = un
  // jour calendaire, donc un espacement égal en index = un espacement égal en jours). "Aujourd'hui"
  // est TOUJOURS affiché (jamais masqué, même près d'un bord) : une graduation régulière trop
  // proche perd son étiquette à sa place (mais garde son trait), et l'ancrage du texte
  // "Aujourd'hui" s'adapte près des bords pour ne jamais sortir du cadre.
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const tickIndices = Array.from(new Set(tickFractions.map((f) => Math.round(f * lastIndex))));
  const todayLabelX = todayIndex !== -1 ? x(todayIndex) : null;
  const todayLabelAnchor: "start" | "middle" | "end" =
    todayLabelX == null ? "middle" : todayLabelX < PAD_LEFT + LABEL_CLEARANCE ? "start" : todayLabelX > VIEW_W - PAD_RIGHT - LABEL_CLEARANCE ? "end" : "middle";

  return (
    <div className="space-y-2">
      <div className="w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {gridSteps.map((s) => (
            <line
              key={s}
              x1={PAD_LEFT}
              x2={VIEW_W - PAD_RIGHT}
              y1={PAD_TOP + PLOT_H * (1 - s)}
              y2={PAD_TOP + PLOT_H * (1 - s)}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
          ))}
          {gridSteps.map((s) => (
            <text key={s} x={PAD_LEFT - 6} y={PAD_TOP + PLOT_H * (1 - s) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {formatCurrency(maxValue * s, currency)}
            </text>
          ))}

          {todayIndex !== -1 && (
            <line x1={x(todayIndex)} x2={x(todayIndex)} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} className="stroke-violet-500" strokeWidth={1.5} strokeDasharray="4 3" />
          )}

          <path d={actualAreaPath} fill="hsl(var(--accent) / 0.12)" stroke="none" />
          <path d={plannedPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
          <path d={actualPath} fill="none" stroke="hsl(var(--accent))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          <circle cx={x(activeIndex)} cy={y(active.plannedCumulative)} r={4} fill="hsl(var(--muted-foreground))" stroke="hsl(var(--card))" strokeWidth={2} />
          <circle cx={x(activeIndex)} cy={y(active.actualCumulative)} r={4} fill="hsl(var(--accent))" stroke="hsl(var(--card))" strokeWidth={2} />
          {hoverIndex != null && (
            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} stroke="hsl(var(--foreground))" strokeWidth={1} opacity={0.25} />
          )}

          {tickIndices.map((i) => {
            const tx = x(i);
            const hideLabel = todayLabelX != null && Math.abs(tx - todayLabelX) < LABEL_CLEARANCE;
            return (
              <g key={i}>
                <line x1={tx} x2={tx} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H + 3} stroke="hsl(var(--border))" strokeWidth={1} />
                {!hideLabel && (
                  <text
                    x={tx}
                    y={VIEW_H - 6}
                    textAnchor={i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
                    className="fill-muted-foreground text-[9px]"
                  >
                    {formatShortDate(points[i].date)}
                  </text>
                )}
              </g>
            );
          })}
          {todayLabelX != null && (
            <text x={todayLabelX} y={VIEW_H - 6} textAnchor={todayLabelAnchor} className="fill-violet-500 text-[9px] font-semibold">
              Aujourd'hui
            </text>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full border-t-2 border-dashed border-muted-foreground" />
          Prévisionnel (selon l'itinéraire)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-accent" />
          Réel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 rounded-full bg-violet-500" />
          Aujourd'hui
        </span>
      </div>

      <div className={cn("flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-sm", hoverIndex == null && "bg-muted/30")}>
        <span className="font-medium">
          {hoverIndex != null ? formatDate(active.date) : beforeTrip ? "Le voyage n'a pas encore commencé" : afterTrip ? "Voyage terminé" : "Aujourd'hui"}
        </span>
        <span className="text-muted-foreground">
          prévu {formatCurrency(active.plannedCumulative, currency)} · réel {formatCurrency(active.actualCumulative, currency)}
        </span>
        {active.plannedCumulative > 0 && <ConsumedPctBadge pct={activePct} className="ml-auto px-2 py-0.5 text-sm font-bold" />}
      </div>
    </div>
  );
}
