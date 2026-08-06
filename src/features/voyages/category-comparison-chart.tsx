import { cn, formatCurrency } from "@/lib/utils";

export type CategoryComparisonRow = { key: string; label: string; planned: number; actual: number };

const HUE_CLASSES = {
  sky: { track: "bg-sky-500/8", band: "bg-sky-400/35 dark:bg-sky-500/40", fill: "bg-sky-500 dark:bg-sky-400", tick: "bg-sky-900 dark:bg-sky-50" },
  violet: { track: "bg-violet-500/8", band: "bg-violet-400/35 dark:bg-violet-500/40", fill: "bg-violet-500 dark:bg-violet-400", tick: "bg-violet-900 dark:bg-violet-50" },
  amber: { track: "bg-amber-500/8", band: "bg-amber-400/35 dark:bg-amber-500/40", fill: "bg-amber-500 dark:bg-amber-400", tick: "bg-amber-900 dark:bg-amber-50" },
  emerald: { track: "bg-emerald-500/8", band: "bg-emerald-400/35 dark:bg-emerald-500/40", fill: "bg-emerald-500 dark:bg-emerald-400", tick: "bg-emerald-900 dark:bg-emerald-50" },
  orange: { track: "bg-orange-500/8", band: "bg-orange-400/35 dark:bg-orange-500/40", fill: "bg-orange-500 dark:bg-orange-400", tick: "bg-orange-900 dark:bg-orange-50" },
  rose: { track: "bg-rose-500/8", band: "bg-rose-400/35 dark:bg-rose-500/40", fill: "bg-rose-500 dark:bg-rose-400", tick: "bg-rose-900 dark:bg-rose-50" },
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

/** Longueur de barre (%) pour une valeur donnée par rapport au maximum COMMUN à toutes les
 * lignes du graphique (pas au maximum de sa propre ligne) — indispensable pour que les barres
 * restent comparables entre catégories (une catégorie deux fois plus chère qu'une autre doit
 * avoir une barre visiblement plus longue). Racine carrée plutôt que linéaire : purement
 * proportionnel, une catégorie à 1% du budget total aurait une barre quasi invisible (large
 * plage de valeurs habituelle entre ex. équipement et logement) — la racine carrée compresse
 * l'écart pour que les petits montants restent visibles tout en gardant l'ordre et un écart net
 * avec les plus gros. Plancher à 2% pour qu'un montant non nul, même minime, reste toujours visible. */
function barPct(value: number, globalMax: number): number {
  if (value <= 0) return 0;
  if (globalMax <= 0) return 0;
  return Math.max(2, Math.min(100, Math.sqrt(value / globalMax) * 100));
}

/** % du prévisionnel déjà consommé (réel / prévu) : null si rien n'est prévu pour cette
 * catégorie (pourcentage non significatif sans référence à comparer). */
function consumedPct(actual: number, planned: number): number | null {
  if (planned <= 0) return null;
  return Math.round((actual / planned) * 100);
}

/** Vert = large marge, ambre = proche du budget, rouge = dépassement — mêmes seuils que le
 * reste de l'application pour tout indicateur de consommation de budget. */
function consumedPctClasses(pct: number): string {
  if (pct > 105) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (pct >= 85) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

/**
 * Graphique en "bullet" (une ligne par catégorie) : le remplissage plein est TOUJOURS le réel,
 * la bande plus claire TOUJOURS le prévisionnel (avec un repère net à son bord) — jamais
 * l'inverse d'un graphique à l'autre. Toutes les lignes partagent la même échelle (voir barPct)
 * pour que la longueur des barres reste comparable d'une catégorie à l'autre, les valeurs exactes
 * toujours lisibles en clair à droite.
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

  const globalMax = Math.max(...rows.flatMap((r) => [r.planned, r.actual]), 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-muted-foreground/70" /> Réel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-muted-foreground/25" /> Prévisionnel
        </span>
      </div>
      {rows.map((r) => {
        const h = HUE_CLASSES[hue ?? CATEGORY_HUES[r.key] ?? "sky"];
        const actualPct = barPct(r.actual, globalMax);
        const plannedPct = barPct(r.planned, globalMax);
        const pct = consumedPct(r.actual, r.planned);
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-36 shrink-0 whitespace-normal text-xs font-medium leading-tight">{r.label}</span>
            <div className={cn("relative h-4 flex-1 overflow-hidden rounded-sm", h.track)}>
              <div className={cn("absolute inset-y-0 left-0 rounded-sm", h.band)} style={{ width: `${plannedPct}%` }} />
              <div className={cn("absolute inset-y-1 left-0 rounded-sm", h.fill)} style={{ width: `${actualPct}%` }} />
              {r.planned > 0 && <div className={cn("absolute inset-y-0 w-0.5", h.tick)} style={{ left: `${plannedPct}%` }} />}
            </div>
            <span className="w-36 shrink-0 text-right text-xs">
              <span className="font-semibold">{formatCurrency(r.actual, currency)}</span>
              <span className="text-muted-foreground"> / {formatCurrency(r.planned, currency)}</span>
            </span>
            <span className={cn("w-12 shrink-0 rounded-full py-0.5 text-center text-[0.7rem] font-semibold", pct != null ? consumedPctClasses(pct) : "text-muted-foreground")}>
              {pct != null ? `${pct}%` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
