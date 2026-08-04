import { CLIMATE_COLOR_CLASS, CLIMATE_RATING_CYCLE, MONTH_LABELS } from "@/features/voyages/itinerary/itinerary-model";
import { cn } from "@/lib/utils";
import type { ClimateRating } from "@/types/database";

/** Bande de 12 mois cliquable (cycle favorable / moyen / déconseillé), partagée entre le
 * dialogue étape (climat du pays) et le dialogue sous-étape (climat propre à une ville). */
export function ClimateMonthPicker({ value, onChange }: { value: ClimateRating[]; onChange: (next: ClimateRating[]) => void }) {
  function cycle(index: number) {
    const next = [...value];
    const currentIndex = CLIMATE_RATING_CYCLE.indexOf(next[index]);
    next[index] = CLIMATE_RATING_CYCLE[(currentIndex + 1) % CLIMATE_RATING_CYCLE.length];
    onChange(next);
  }

  return (
    <div className="flex overflow-hidden rounded-md">
      {value.map((rating, i) => (
        <button
          key={i}
          type="button"
          onClick={() => cycle(i)}
          title={MONTH_LABELS[i]}
          className={cn("h-8 flex-1 text-[0.65rem] font-semibold", CLIMATE_COLOR_CLASS[rating])}
        >
          {MONTH_LABELS[i]}
        </button>
      ))}
    </div>
  );
}
