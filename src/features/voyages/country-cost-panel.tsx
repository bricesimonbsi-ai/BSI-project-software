import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useEtapes, useUpdateEtape } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { buildFlatRows, groupByCountry } from "@/features/voyages/itinerary/itinerary-model";
import { findCountryByName, CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { estimateCostsByCountry, type CountryCostResult } from "@/features/voyages/cost-of-living";
import { formatCurrency } from "@/lib/utils";
import type { TravelStyle, VoyageSousEtape } from "@/types/database";

/**
 * Vue d'ensemble éditable des coûts prévisionnels par pays (hébergement/nuit, nourriture/jour) :
 * préremplie par l'estimation automatique (coût de la vie du pays), ajustable manuellement —
 * la valeur saisie devient alors prioritaire sur l'estimation pour ce pays.
 */
export function CountryCostPanel({
  voyageId,
  style,
  travelerCount,
  lodgingCount,
}: {
  voyageId: string;
  style: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
}) {
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const updateEtape = useUpdateEtape(voyageId);

  const groups = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    const flat = buildFlatRows(etapes ?? [], map);
    return groupByCountry(etapes ?? [], flat).filter((g) => g.totalNights > 0);
  }, [etapes, allSousEtapes]);

  const [results, setResults] = useState<CountryCostResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const input = groups.map((g) => ({
        etapeId: g.etape.id,
        countryCode: findCountryByName(g.etape.country_region)?.cca2 ?? null,
        nights: g.totalNights,
        lodgingOverride: g.etape.lodging_cost_per_night,
        foodOverride: g.etape.food_cost_per_day,
      }));
      const res = await estimateCostsByCountry(input, style, travelerCount, lodgingCount);
      if (!cancelled) setResults(res);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, style, travelerCount, lodgingCount]);

  if (groups.length === 0) return null;

  function handleRateChange(etapeId: string, field: "lodging_cost_per_night" | "food_cost_per_day", value: string) {
    updateEtape.mutate({ id: etapeId, [field]: value.trim() === "" ? null : Number(value) });
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Coûts prévisionnels par pays (modifiable)
      </h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2 text-right">Nuits</th>
              <th className="px-3 py-2 text-right">Logement / nuit</th>
              <th className="px-3 py-2 text-right">Nourriture / jour / pers.</th>
              <th className="px-3 py-2 text-right">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const r = results.find((res) => res.etapeId === g.etape.id);
              return (
                <tr key={g.etape.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CountryFlag name={g.etape.country_region} />
                      {g.etape.country_region}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{g.totalNights}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      step="1"
                      className="ml-auto w-24 text-right"
                      placeholder={r ? Math.round(r.lodgingRate).toString() : "..."}
                      defaultValue={g.etape.lodging_cost_per_night?.toString() ?? ""}
                      onBlur={(e) => handleRateChange(g.etape.id, "lodging_cost_per_night", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      step="1"
                      className="ml-auto w-24 text-right"
                      placeholder={r ? Math.round(r.foodRate).toString() : "..."}
                      defaultValue={g.etape.food_cost_per_day?.toString() ?? ""}
                      onBlur={(e) => handleRateChange(g.etape.id, "food_cost_per_day", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {r ? formatCurrency(r.lodgingTotal + r.foodTotal, "EUR") : "..."}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Les champs vides utilisent l'estimation automatique (indiquée en filigrane) basée sur le coût de la vie du pays ;
        saisis un montant pour l'ajuster toi-même — il remplace alors l'estimation partout où elle est utilisée. Toujours
        en EUR.
      </p>
    </div>
  );
}
