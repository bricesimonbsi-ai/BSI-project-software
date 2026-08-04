import { useMemo } from "react";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { buildFlatRows, getItineraryDateRange } from "@/features/voyages/itinerary/itinerary-model";
import type { VoyageSousEtape } from "@/types/database";

/** Dates de début/fin du voyage entier, dérivées de la première/dernière ville de
 * l'itinéraire — jamais une saisie indépendante (voir getItineraryDateRange). */
export function useItineraryDateRange(voyageId: string | undefined): { start: string | null; end: string | null } {
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);

  return useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    const flat = buildFlatRows(etapes ?? [], map);
    return getItineraryDateRange(flat);
  }, [etapes, allSousEtapes]);
}
