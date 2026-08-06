import { formatCurrency } from "@/lib/utils";

/** Palette catégorielle fixe (une couleur par sous-type dans l'ordre d'apparition) — les
 * couleurs identifient un sous-type, pas un statut, donc pas de sens vert/ambre/rouge ici. */
const SLICE_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#6366f1", "#a3a3a3"];

/**
 * Anneau de répartition : le détail des sous-types (avion/train/bus... ou visa/vaccin/frais
 * bancaires...) d'UN total (prévisionnel OU réel, jamais les deux en même temps — voir
 * budget-insights.tsx qui affiche un anneau prévisionnel et un anneau réel côte à côte par
 * grande catégorie), une tranche colorée par sous-type avec sa légende en dessous.
 */
export function CategoryBreakdownRing({
  title,
  total,
  items,
  currency,
  size = 108,
  strokeWidth = 14,
}: {
  title: string;
  total: number;
  /** `color` optionnel : impose une couleur précise (ex. pour faire correspondre exactement la
   * teinte utilisée dans le graphique en barres pour la même catégorie) — sinon la palette
   * générique ci-dessus s'applique dans l'ordre d'apparition. */
  items: { key: string; label: string; amount: number; color?: string }[];
  currency: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const sliceTotal = items.reduce((sum, i) => sum + i.amount, 0);
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border p-3 text-center">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
          {sliceTotal > 0 &&
            items.map((item, i) => {
              const frac = item.amount / sliceTotal;
              const dash = frac * circumference;
              const circle = (
                <circle
                  key={item.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  stroke={item.color ?? SLICE_COLORS[i % SLICE_COLORS.length]}
                />
              );
              offset += dash;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span className="text-sm font-bold leading-tight">{formatCurrency(total, currency)}</span>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="w-full space-y-0.5 text-left">
          {items.map((item, i) => (
            <li key={item.key} className="flex items-center justify-between gap-2 text-[0.7rem] text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color ?? SLICE_COLORS[i % SLICE_COLORS.length] }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0">{formatCurrency(item.amount, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.7rem] text-muted-foreground">Aucune dépense</p>
      )}
    </div>
  );
}
