import { cn, formatCurrency } from "@/lib/utils";

export type CategoryComparisonRow = { key: string; label: string; planned: number; actual: number };

const HUE_CLASSES = {
  sky: { track: "bg-sky-500/12", fill: "bg-sky-500 dark:bg-sky-400", tick: "bg-sky-900 dark:bg-sky-50" },
  violet: { track: "bg-violet-500/12", fill: "bg-violet-500 dark:bg-violet-400", tick: "bg-violet-900 dark:bg-violet-50" },
  amber: { track: "bg-amber-500/12", fill: "bg-amber-500 dark:bg-amber-400", tick: "bg-amber-900 dark:bg-amber-50" },
  emerald: { track: "bg-emerald-500/12", fill: "bg-emerald-500 dark:bg-emerald-400", tick: "bg-emerald-900 dark:bg-emerald-50" },
  orange: { track: "bg-orange-500/12", fill: "bg-orange-500 dark:bg-orange-400", tick: "bg-orange-900 dark:bg-orange-50" },
  rose: { track: "bg-rose-500/12", fill: "bg-rose-500 dark:bg-rose-400", tick: "bg-rose-900 dark:bg-rose-50" },
} as const;

/** Ordre catégoriel fixe (une teinte par catégorie, jamais permutée) partagé par tous les
 * graphiques budget de l'application — la même catégorie porte toujours la même couleur. */
export const CATEGORY_HUES: Record<string, keyof typeof HUE_CLASSES> = {
  transport: "sky",
  logement: "violet",
  nourriture: "amber",
  activites: "emerald",
  equipement: "orange",
  administratif_sante: "rose",
};

/**
 * Graphique en "bullet" (une ligne par catégorie) : le remplissage plein est TOUJOURS le réel,
 * le repère vertical est TOUJOURS le prévisionnel — jamais l'inverse d'un graphique à l'autre,
 * pour ne plus jamais s'y perdre. Chaque ligne est auto-cadrée sur son propre maximum (forme
 * "bullet" standard) : les valeurs exactes sont toujours lisibles en clair à droite.
 */
export function CategoryComparisonChart({
  rows,
  currency,
  hue,
}: {
  rows: CategoryComparisonRow[];
  currency: string;
  hue?: keyof typeof HUE_CLASSES;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune dépense pour l'instant.</p>;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-muted-foreground/40" /> Réel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-muted-foreground" /> Repère : prévisionnel
        </span>
      </div>
      {rows.map((r) => {
        const h = HUE_CLASSES[hue ?? CATEGORY_HUES[r.key] ?? "sky"];
        const max = Math.max(r.planned, r.actual, 1) * 1.1;
        const actualPct = Math.min(100, (r.actual / max) * 100);
        const plannedPct = Math.min(100, (r.planned / max) * 100);
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs font-medium" title={r.label}>
              {r.label}
            </span>
            <div className={cn("relative h-4 flex-1 overflow-hidden rounded-sm", h.track)}>
              <div className={cn("h-full rounded-sm", h.fill)} style={{ width: `${actualPct}%` }} />
              {r.planned > 0 && (
                <div className={cn("absolute inset-y-0 w-0.5", h.tick)} style={{ left: `${plannedPct}%` }} />
              )}
            </div>
            <span className="w-36 shrink-0 text-right text-xs">
              <span className="font-semibold">{formatCurrency(r.actual, currency)}</span>
              <span className="text-muted-foreground"> / {formatCurrency(r.planned, currency)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
