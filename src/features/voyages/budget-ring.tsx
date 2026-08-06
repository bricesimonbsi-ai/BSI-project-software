import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Anneau de type "compteur" (meter) : le remplissage représente la part du budget
 * prévisionnel déjà dépensée en réel, coloré par statut (vert = confortable, ambre =
 * proche, rouge = dépassé) — jamais deux couleurs pour deux séries (ce serait une
 * identité, pas un statut), le remplissage et le fond utilisent la même famille de teinte.
 */
export function BudgetRing({
  label,
  planned,
  actual,
  currency,
  size = 96,
  /** Sous-détail optionnel affiché sous le libellé (ex. avion/train/bus pour un anneau "Transport"). */
  breakdown,
}: {
  label: string;
  planned: number;
  actual: number;
  currency: string;
  size?: number;
  breakdown?: { key: string; label: string; planned: number; actual: number }[];
}) {
  const pct = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0;
  const displayPct = Math.round(pct);
  const arcPct = Math.min(100, pct);
  const status = pct >= 100 ? "critical" : pct >= 80 ? "warning" : "good";
  const ringClass = {
    good: "stroke-emerald-500",
    warning: "stroke-amber-500",
    critical: "stroke-rose-500",
  }[status];
  const trackClass = {
    good: "stroke-emerald-500/15",
    warning: "stroke-amber-500/15",
    critical: "stroke-rose-500/15",
  }[status];
  const textClass = {
    good: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    critical: "text-rose-700 dark:text-rose-300",
  }[status];

  const strokeWidth = 10;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (arcPct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className={trackClass} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className={ringClass}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold", textClass)}>{displayPct}%</span>
        </div>
      </div>
      <div className="w-full">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(actual, currency)} / {formatCurrency(planned, currency)}
        </p>
      </div>
      {breakdown && breakdown.length > 0 && (
        <ul className="w-full space-y-0.5 border-t border-border pt-1.5 text-left">
          {breakdown.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
              <span className="truncate">{b.label}</span>
              <span className="whitespace-nowrap">
                {formatCurrency(b.actual, currency)} / {formatCurrency(b.planned, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
