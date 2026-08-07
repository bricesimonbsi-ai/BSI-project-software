import { addDays, type FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import { CITY_COLUMNS, cityColumnAmount } from "@/features/voyages/budget-overview-table";
import type { CityLockedCosts } from "@/features/voyages/use-city-locked-costs";
import type { VoyageAllExpense } from "@/types/database";

export type TimelinePoint = { date: string; plannedCumulative: number; actualCumulative: number };

/** Date calendaire du jour, en heure LOCALE (pas UTC) : c'est le "aujourd'hui" que l'utilisateur
 * perçoit, pas celui d'un fuseau arbitraire — un `toISOString()` déciderait du jour selon UTC et
 * pourrait afficher la mauvaise date en soirée pour un fuseau à l'ouest de Greenwich. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Regroupe les dépenses réelles par date, en euros de référence — toute dépense hors des bornes
 * du voyage (avant le départ, après le retour) ou sans date du tout est ÉCRÊTÉE sur la borne la
 * plus proche (jamais ignorée : le total de la courbe doit toujours retomber exactement sur le
 * total réel affiché ailleurs — voir "Total = somme de ce qui est affiché", principe appliqué
 * partout dans ce module Budget). */
export function buildActualAmountByDate(actualExpenses: VoyageAllExpense[], start: string, end: string): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const e of actualExpenses) {
    const raw = e.expense_date ?? start;
    const date = raw < start ? start : raw > end ? end : raw;
    byDate.set(date, (byDate.get(date) ?? 0) + e.amount * e.manual_rate_to_reference);
  }
  return byDate;
}

/**
 * Courbe "prévisionnel cumulé selon le voyage planifié" vs "réel cumulé" jour par jour, du début
 * à la fin de l'itinéraire — pour savoir, à une date donnée, si on a dépensé plus ou moins que
 * prévu À CE STADE du voyage (pas juste plus/moins que le budget total, qui ne dit rien du
 * rythme). Le prévisionnel par ville (logement/nourriture/transport sur place/activités) est
 * réparti uniformément sur ses nuits ; le transport vers la ville suivante tombe en un seul pic
 * le dernier jour sur place ; équipement/administratif & santé/visa (jamais rattachés à une
 * ville) sont comptés d'avance, au jour 1 (achetés/réglés avant le départ dans la réalité).
 * Réutilise exactement `cityColumnAmount`/`CITY_COLUMNS` du tableau détail des dépenses : jamais
 * un chiffre recalculé indépendamment qui pourrait diverger de ce qui y est affiché.
 */
export function buildBudgetTimeline({
  flat,
  expensesBySousEtape,
  lockedByCity,
  upfrontPlanned,
  actualAmountByDate,
}: {
  flat: FlatRow[];
  /** Dépenses PRÉVISIONNELLES de chaque ville (déjà filtrées `planned && sous_etape_id === ville`). */
  expensesBySousEtape: Map<string, VoyageAllExpense[]>;
  lockedByCity: Record<string, CityLockedCosts>;
  upfrontPlanned: number;
  actualAmountByDate: Map<string, number>;
}): TimelinePoint[] {
  if (flat.length === 0) return [];
  const start = flat[0].sousEtape.start_date;
  const end = flat[flat.length - 1].sousEtape.end_date;
  if (!start || !end) return [];

  const dailyRateByCity = new Map<string, number>();
  const transportLegByLastDay = new Map<string, number>();
  for (const row of flat) {
    const city = row.sousEtape;
    const cityRows = expensesBySousEtape.get(city.id) ?? [];
    const locked = lockedByCity[city.id];
    const amounts = CITY_COLUMNS.map((c) => cityColumnAmount(c, cityRows, locked));
    // Ordre de CITY_COLUMNS : [transport vers la suivante, transport sur place, logement, nourriture, activités].
    const [transportNext, transportLocal, logement, nourriture, activites] = amounts;
    const nights = Math.max(1, city.duration_days ?? 1);
    dailyRateByCity.set(city.id, (transportLocal + logement + nourriture + activites) / nights);
    if (transportNext > 0 && city.end_date) {
      const lastDay = addDays(city.end_date, -1);
      transportLegByLastDay.set(lastDay, (transportLegByLastDay.get(lastDay) ?? 0) + transportNext);
    }
  }

  function activeCityId(date: string): string | null {
    const row = flat.find((r) => r.sousEtape.start_date && r.sousEtape.end_date && date >= r.sousEtape.start_date && date < r.sousEtape.end_date);
    if (row) return row.sousEtape.id;
    return date === end ? flat[flat.length - 1].sousEtape.id : null;
  }

  const points: TimelinePoint[] = [];
  let plannedCumulative = 0;
  let actualCumulative = 0;
  let date = start;
  let guard = 0;
  while (date <= end && guard < 3660) {
    if (guard === 0) plannedCumulative += upfrontPlanned;
    const cityId = activeCityId(date);
    if (cityId) plannedCumulative += dailyRateByCity.get(cityId) ?? 0;
    plannedCumulative += transportLegByLastDay.get(date) ?? 0;
    actualCumulative += actualAmountByDate.get(date) ?? 0;
    points.push({ date, plannedCumulative, actualCumulative });
    date = addDays(date, 1);
    guard++;
  }
  return points;
}
