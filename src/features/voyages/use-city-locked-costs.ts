import { useEffect, useMemo, useState } from "react";
import { estimateCityDailyRates } from "@/features/voyages/cost-of-living";
import { findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { groupedCategory } from "@/features/voyages/use-expenses";
import type { ExpenseCategory, TravelStyle, VoyageEtape, VoyageSousEtape } from "@/types/database";

export type CityLockedCosts = { lodging: number; food: number; localTransport: number };

/** Une ligne `voyage_expenses` prévisionnelle de logement/nourriture/transport-sur-place est
 * une ANCIENNE ligne (créée avant que ces coûts deviennent 100% calculés en direct par
 * useCityLockedCostsMap) : à exclure de toute agrégation générique pour ne jamais compter en
 * double avec le calcul en direct — même principe que l'exclusion de la catégorie "equipement". */
export function isLegacyLockedPlannedRow(e: { category: ExpenseCategory; sub_category: string | null; planned: boolean }): boolean {
  if (!e.planned) return false;
  const cat = groupedCategory(e.category);
  if (cat === "logement" || cat === "nourriture") return true;
  return cat === "transport" && e.sub_category === "sur_place";
}

const ZERO_LOCKED_COSTS: CityLockedCosts = { lodging: 0, food: 0, localTransport: 0 };

function addLockedCosts(a: CityLockedCosts, b: CityLockedCosts): CityLockedCosts {
  return { lodging: a.lodging + b.lodging, food: a.food + b.food, localTransport: a.localTransport + b.localTransport };
}

/**
 * Source unique du coût prévisionnel logement/nourriture/transport sur place, par ville et
 * agrégé sur tout le voyage — calculé 100% côté client (taux journalier x nuits x
 * voyageurs/logements), jamais depuis une ligne `voyage_expenses` à tenir synchronisée.
 * Utilisé à la fois par le tableau détail des dépenses et le résumé du budget (budget-insights)
 * pour garantir qu'ils affichent TOUJOURS exactement le même chiffre, sans délai de
 * resynchronisation possible : il n'y a rien à synchroniser, seulement à recalculer.
 */
export function useCityLockedCostsMap(params: {
  etapes: VoyageEtape[] | undefined;
  sousEtapes: VoyageSousEtape[] | undefined;
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
}): { byCity: Record<string, CityLockedCosts>; total: CityLockedCosts } {
  const { etapes, sousEtapes, travelStyle, travelerCount, lodgingCount } = params;
  const [byCity, setByCity] = useState<Record<string, CityLockedCosts>>({});

  const etapeById = useMemo(() => {
    const map = new Map<string, VoyageEtape>();
    for (const e of etapes ?? []) map.set(e.id, e);
    return map;
  }, [etapes]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const entries = await Promise.all(
        (sousEtapes ?? []).map(async (se): Promise<[string, CityLockedCosts] | null> => {
          const etape = etapeById.get(se.etape_id);
          if (!etape) return null;
          const countryCode = findCountryByName(etape.country_region)?.cca2 ?? null;
          const rates = await estimateCityDailyRates({
            countryCode,
            style: travelStyle,
            lodgingOverride: etape.lodging_cost_per_night,
            foodOverride: etape.food_cost_per_day,
            localTransportOverride: etape.local_transport_cost_per_day,
          });
          const nights = se.duration_days ?? 0;
          const rooms = Math.max(1, lodgingCount || 1);
          const travelers = Math.max(1, travelerCount || 1);
          return [
            se.id,
            {
              lodging: nights * rooms * rates.lodging,
              food: nights * travelers * rates.food,
              localTransport: nights * travelers * rates.localTransport,
            },
          ];
        })
      );
      if (cancelled) return;
      const map: Record<string, CityLockedCosts> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setByCity(map);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [etapeById, sousEtapes, travelStyle, travelerCount, lodgingCount]);

  const total = useMemo(() => Object.values(byCity).reduce(addLockedCosts, ZERO_LOCKED_COSTS), [byCity]);

  return { byCity, total };
}

export { ZERO_LOCKED_COSTS };
