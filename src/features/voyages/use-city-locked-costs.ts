import { useEffect, useMemo, useState } from "react";
import { estimateCityDailyRates } from "@/features/voyages/cost-of-living";
import { resolveTransportLegCost } from "@/features/voyages/budget-estimate";
import { findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { buildFlatRows, haversineDistanceKm } from "@/features/voyages/itinerary/itinerary-model";
import { groupedCategory } from "@/features/voyages/use-expenses";
import type { ExpenseCategory, TravelStyle, VoyageEtape, VoyageSousEtape } from "@/types/database";

export type CityLockedCosts = { lodging: number; food: number; localTransport: number; transport: number };

/** Une ligne `voyage_expenses` prévisionnelle de logement/nourriture/transport (sur place OU vers
 * l'étape suivante) est une ANCIENNE ligne (créée avant que ces coûts deviennent 100% calculés en
 * direct par useCityLockedCostsMap) : à exclure de toute agrégation générique pour ne jamais
 * compter en double avec le calcul en direct — même principe que l'exclusion de la catégorie
 * "equipement". Le transport vers l'étape suivante a rejoint ce groupe : avant ce correctif, il
 * restait une ligne éditable à part (sans jamais lire `transport_next_cost`), ce qui pouvait créer
 * une ligne réelle pour UNE ville sans ça pour les autres et rendre le total du pays incohérent
 * avec la somme visible des villes. */
export function isLegacyLockedPlannedRow(e: { category: ExpenseCategory; sub_category: string | null; planned: boolean }): boolean {
  if (!e.planned) return false;
  const cat = groupedCategory(e.category);
  return cat === "logement" || cat === "nourriture" || cat === "transport";
}

const ZERO_LOCKED_COSTS: CityLockedCosts = { lodging: 0, food: 0, localTransport: 0, transport: 0 };

function addLockedCosts(a: CityLockedCosts, b: CityLockedCosts): CityLockedCosts {
  return {
    lodging: a.lodging + b.lodging,
    food: a.food + b.food,
    localTransport: a.localTransport + b.localTransport,
    transport: a.transport + b.transport,
  };
}

/**
 * Source unique du coût prévisionnel logement/nourriture/transport sur place ET transport vers
 * l'étape suivante, par ville et agrégé sur tout le voyage — calculé 100% côté client, jamais
 * depuis une ligne `voyage_expenses` à tenir synchronisée. Utilisé à la fois par le tableau détail
 * des dépenses et le résumé du budget (budget-insights) pour garantir qu'ils affichent TOUJOURS
 * exactement le même chiffre, sans délai de resynchronisation possible : il n'y a rien à
 * synchroniser, seulement à recalculer.
 *
 * Transport vers l'étape suivante : voir resolveTransportLegCost (budget-estimate.ts) pour la
 * priorité coût réel / estimation, partagée avec SousEtapeDialog.
 */
export function useCityLockedCostsMap(params: {
  etapes: VoyageEtape[] | undefined;
  sousEtapes: VoyageSousEtape[] | undefined;
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
}): { byCity: Record<string, CityLockedCosts>; total: CityLockedCosts } {
  const { etapes, sousEtapes, travelStyle, travelerCount, lodgingCount, referenceCurrency } = params;
  const [byCity, setByCity] = useState<Record<string, CityLockedCosts>>({});

  const etapeById = useMemo(() => {
    const map = new Map<string, VoyageEtape>();
    for (const e of etapes ?? []) map.set(e.id, e);
    return map;
  }, [etapes]);

  const sousEtapesByEtape = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of sousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    return map;
  }, [sousEtapes]);

  const nextDistanceById = useMemo(() => {
    const flat = buildFlatRows(etapes ?? [], sousEtapesByEtape);
    const byIndex = new Map(flat.map((r) => [r.globalIndex, r]));
    const map = new Map<string, number | null>();
    for (const row of flat) {
      const next = byIndex.get(row.globalIndex + 1);
      const { latitude, longitude } = row.sousEtape;
      map.set(
        row.sousEtape.id,
        latitude != null && longitude != null && next?.sousEtape.latitude != null && next?.sousEtape.longitude != null
          ? haversineDistanceKm(latitude, longitude, next.sousEtape.latitude, next.sousEtape.longitude)
          : row.sousEtape.distance_km
      );
    }
    return map;
  }, [etapes, sousEtapesByEtape]);

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
            // Overrides propres à CETTE ville, pas au pays : ajuster le taux d'une ville ne doit
            // jamais changer le montant affiché pour les autres villes du même pays.
            lodgingOverride: se.lodging_cost_per_night,
            foodOverride: se.food_cost_per_day,
            localTransportOverride: se.local_transport_cost_per_day,
          });
          const nights = se.duration_days ?? 0;
          const rooms = Math.max(1, lodgingCount || 1);
          const travelers = Math.max(1, travelerCount || 1);
          const transport = resolveTransportLegCost({
            transportNextCost: se.transport_next_cost,
            transportNextCurrency: se.transport_next_currency,
            referenceCurrency,
            distanceKm: nextDistanceById.get(se.id) ?? null,
            mode: se.transport_next_mode,
            travelerCount: travelers,
          });
          return [
            se.id,
            {
              lodging: nights * rooms * rates.lodging,
              food: nights * travelers * rates.food,
              localTransport: nights * travelers * rates.localTransport,
              transport,
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
  }, [etapeById, sousEtapes, travelStyle, travelerCount, lodgingCount, referenceCurrency, nextDistanceById]);

  const total = useMemo(() => Object.values(byCity).reduce(addLockedCosts, ZERO_LOCKED_COSTS), [byCity]);

  return { byCity, total };
}

export { ZERO_LOCKED_COSTS };
