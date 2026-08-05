import { cn, formatCurrency } from "@/lib/utils";

export type CategoryComparisonRow = { key: string; label: string; planned: number; actual: number };

const HUE_CLASSES = {
  sky: { track: "bg-sky-500/10", planned: "bg-sky-300 dark:bg-sky-700", actual: "bg-sky-500 dark:bg-sky-400" },
  violet: { track: "bg-violet-500/10", planned: "bg-violet-300 dark:bg-violet-700", actual: "bg-violet-500 dark:bg-violet-400" },
  amber: { track: "bg-amber-500/10", planned: "bg-amber-300 dark:bg-amber-700", actual: "bg-amber-500 dark:bg-amber-400" },
  emerald: { track: "bg-emerald-500/10", planned: "bg-emerald-300 dark:bg-emerald-700", actual: "bg-emerald-500 dark:bg-emerald-400" },
  orange: { track: "bg-orange-500/10", planned: "bg-orange-300 dark:bg-orange-700", actual: "bg-orange-500 dark:bg-orange-400" },
  rose: { track: "bg-rose-500/10", planned: "bg-rose-300 dark:bg-rose-700", actual: "bg-rose-500 dark:bg-rose-400" },
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
 * Barres appariées prévisionnel (teinte claire) / réel (teinte pleine), une teinte par
 * catégorie (jamais deux catégories dans la même couleur). Pour un détail par sous-catégorie
 * (mode de transport, type de frais admin/santé), passer `hue` pour forcer une teinte unique
 * (celle de la catégorie parente) plutôt qu'une par ligne.
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
  const max = Math.max(1, ...rows.flatMap((r) => [r.planned, r.actual]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-muted-foreground/30" /> Prévisionnel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-muted-foreground" /> Réel
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const h = HUE_CLASSES[hue ?? CATEGORY_HUES[r.key] ?? "sky"];
          return (
            <div key={r.key} className="space-y-1">
              <p className="text-xs font-medium">{r.label}</p>
              <div className="flex items-center gap-2">
                <div className={cn("h-2.5 flex-1 overflow-hidden rounded-full", h.track)}>
                  <div className={cn("h-full rounded-full", h.planned)} style={{ width: `${(r.planned / max) * 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{formatCurrency(r.planned, currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("h-2.5 flex-1 overflow-hidden rounded-full", h.track)}>
                  <div className={cn("h-full rounded-full", h.actual)} style={{ width: `${(r.actual / max) * 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold">{formatCurrency(r.actual, currency)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
