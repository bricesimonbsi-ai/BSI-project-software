import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export type CategoryComparisonRow = {
  key: string;
  label: string;
  planned: number;
  actual: number;
  /** Détail par sous-type (ex. mode de transport, type de frais administratif) — replié par
   * défaut, dépliable au clic sur la ligne. Un seul niveau (les sous-lignes n'ont pas les leurs). */
  subRows?: { key: string; label: string; planned: number; actual: number }[];
};

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

/** Même teinte que CATEGORY_HUES, en hexadécimal — pour les graphiques SVG (anneaux) qui ne
 * peuvent pas utiliser les classes Tailwind ci-dessus. */
export const CATEGORY_HUE_HEX: Record<string, string> = {
  transport: "#0ea5e9",
  logement: "#8b5cf6",
  nourriture: "#f59e0b",
  activites: "#10b981",
  equipement: "#f97316",
  administratif_sante: "#f43f5e",
};

/** Longueur de barre (%) pour une valeur donnée par rapport au maximum COMMUN à toutes les
 * lignes du graphique (pas au maximum de sa propre ligne) — indispensable pour que les barres
 * restent comparables entre catégories (une catégorie deux fois plus chère qu'une autre doit
 * avoir une barre visiblement plus longue). Racine carrée plutôt que linéaire : purement
 * proportionnel, une catégorie à 1% du budget total aurait une barre quasi invisible (large
 * plage de valeurs habituelle entre ex. équipement et logement) — la racine carrée compresse
 * l'écart pour que les petits montants restent visibles tout en gardant l'ordre et un écart net
 * avec les plus gros. Plancher à 2% pour qu'un montant non nul, même minime, reste toujours visible. */
function barPct(value: number, groupMax: number): number {
  if (value <= 0) return 0;
  if (groupMax <= 0) return 0;
  return Math.max(2, Math.min(100, Math.sqrt(value / groupMax) * 100));
}

/** % du prévisionnel déjà consommé (réel / prévu) : null si rien n'est prévu (pourcentage non
 * significatif sans référence à comparer). Exporté : réutilisé pour le % de consommation global
 * du voyage entier, avec les mêmes seuils de couleur. */
export function consumedPct(actual: number, planned: number): number | null {
  if (planned <= 0) return null;
  return Math.round((actual / planned) * 100);
}

/** Dégradé vert (0%) → rouge (100% ou plus), en 5 paliers — mêmes seuils partout où un
 * pourcentage de consommation de budget est affiché. */
export function consumedPctClasses(pct: number): string {
  if (pct >= 100) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (pct >= 75) return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
  if (pct >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (pct >= 25) return "bg-lime-500/15 text-lime-700 dark:text-lime-300";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

/** Pastille de pourcentage de consommation (réel / prévu), colorée — utilisée à toutes les
 * échelles (globale, par catégorie, par sous-type) pour un langage visuel cohérent. Exportée :
 * réutilisée pour le % de consommation global du voyage (hors de ce graphique). */
export function ConsumedPctBadge({ pct, className, title }: { pct: number | null; className?: string; title?: string }) {
  return (
    <span
      className={cn("shrink-0 rounded-full py-0.5 text-center font-semibold", pct != null ? consumedPctClasses(pct) : "text-muted-foreground", className)}
      title={title}
    >
      {pct != null ? `${pct}%` : "—"}
    </span>
  );
}

/**
 * Graphique en "bullet" (une ligne par catégorie) : le remplissage plein est TOUJOURS le réel,
 * la bande plus claire TOUJOURS le prévisionnel (avec un repère net à son bord) — jamais
 * l'inverse d'un graphique à l'autre. Toutes les lignes principales partagent la même échelle
 * (voir barPct) pour que la longueur des barres reste comparable d'une catégorie à l'autre, les
 * valeurs exactes et le % du budget consommé toujours lisibles à droite. Une catégorie avec un
 * détail par sous-type (transport, administratif & santé) se déplie au clic sur son libellé pour
 * afficher des sous-barres, à une échelle propre à ce détail (pour rester lisible même si la
 * catégorie parente est petite face aux autres).
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune dépense pour l'instant.</p>;

  const globalMax = Math.max(...rows.flatMap((r) => [r.planned, r.actual]), 1);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
        const hasSubRows = !!r.subRows && r.subRows.length > 0;
        const isExpanded = hasSubRows && expanded.has(r.key);
        const subGroupMax = hasSubRows ? Math.max(...r.subRows!.flatMap((s) => [s.planned, s.actual]), 1) : 1;
        return (
          <div key={r.key}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => hasSubRows && toggle(r.key)}
                disabled={!hasSubRows}
                className={cn(
                  "flex w-36 shrink-0 items-center gap-1 text-left text-xs font-medium leading-tight",
                  hasSubRows ? "cursor-pointer hover:text-foreground" : "cursor-default"
                )}
                title={hasSubRows ? (isExpanded ? "Replier le détail" : "Déplier le détail") : undefined}
              >
                {hasSubRows ? (
                  isExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span className="whitespace-normal">{r.label}</span>
              </button>
              <div className={cn("relative h-4 flex-1 overflow-hidden rounded-sm", h.track)}>
                <div className={cn("absolute inset-y-0 left-0 rounded-sm", h.band)} style={{ width: `${plannedPct}%` }} />
                <div className={cn("absolute inset-y-1 left-0 rounded-sm", h.fill)} style={{ width: `${actualPct}%` }} />
                {r.planned > 0 && <div className={cn("absolute inset-y-0 w-0.5", h.tick)} style={{ left: `${plannedPct}%` }} />}
              </div>
              <span className="w-36 shrink-0 text-right text-xs">
                <span className="font-semibold">{formatCurrency(r.actual, currency)}</span>
                <span className="text-muted-foreground"> / {formatCurrency(r.planned, currency)}</span>
              </span>
              <ConsumedPctBadge pct={pct} className="w-12 text-[0.7rem]" />
            </div>
            {isExpanded && (
              <div className="ml-8 mt-1.5 space-y-1.5 border-l border-border py-0.5 pl-3">
                {r.subRows!.map((s) => {
                  // Mise à l'échelle propre au détail (barPct sur subGroupMax) PUIS ramenée dans
                  // la largeur de la barre parente (actualPct/plannedPct) : une sous-barre ne doit
                  // jamais paraître plus grande que la barre de sa catégorie, même si elle occupe
                  // la totalité de son propre sous-groupe.
                  const sActualPct = (barPct(s.actual, subGroupMax) * actualPct) / 100;
                  const sPlannedPct = (barPct(s.planned, subGroupMax) * plannedPct) / 100;
                  const sPct = consumedPct(s.actual, s.planned);
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 whitespace-normal text-[0.7rem] leading-tight text-muted-foreground">{s.label}</span>
                      <div className={cn("relative h-2.5 flex-1 overflow-hidden rounded-sm", h.track)}>
                        <div className={cn("absolute inset-y-0 left-0 rounded-sm", h.band)} style={{ width: `${sPlannedPct}%` }} />
                        <div className={cn("absolute inset-y-0.5 left-0 rounded-sm", h.fill)} style={{ width: `${sActualPct}%` }} />
                      </div>
                      <span className="w-32 shrink-0 text-right text-[0.7rem]">
                        <span className="font-medium">{formatCurrency(s.actual, currency)}</span>
                        <span className="text-muted-foreground"> / {formatCurrency(s.planned, currency)}</span>
                      </span>
                      <ConsumedPctBadge pct={sPct} className="w-10 text-[0.65rem]" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
