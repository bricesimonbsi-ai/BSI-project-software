import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useVoyageBudgetSummary } from "@/features/voyages/use-expenses";
import { buildFlatRows, groupByCountry, estimateTotalCo2Kg } from "@/features/voyages/itinerary/itinerary-model";
import { formatCurrency } from "@/lib/utils";
import type { VoyageSousEtape } from "@/types/database";

/** Synthèse visuelle du voyage (nombre d'étapes, distance, durée, budget, empreinte carbone),
 * calculée à partir des mêmes données que l'onglet Itinéraire (requêtes déjà en cache). */
export function VoyageSynthesis({ voyageId, referenceCurrency }: { voyageId: string; referenceCurrency: string }) {
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const { data: budgetSummary } = useVoyageBudgetSummary(voyageId);

  const stats = useMemo(() => {
    const sousEtapesByEtape = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = sousEtapesByEtape.get(se.etape_id) ?? [];
      list.push(se);
      sousEtapesByEtape.set(se.etape_id, list);
    }
    const flat = buildFlatRows(etapes ?? [], sousEtapesByEtape);
    const groups = groupByCountry(etapes ?? [], flat);
    const totalKm = flat.reduce((sum, r) => sum + (r.incomingDistanceKm ?? 0), 0);
    const totalNights = flat.reduce((sum, r) => sum + (r.sousEtape.duration_days ?? 0), 0);
    return {
      countryCount: groups.length,
      cityCount: flat.length,
      totalKm,
      totalNights,
      totalCo2: estimateTotalCo2Kg(flat),
    };
  }, [etapes, allSousEtapes]);

  const cards = [
    { label: "Pays", value: `${stats.countryCount}` },
    { label: "Villes / étapes", value: `${stats.cityCount}` },
    { label: "Distance totale", value: `${Math.round(stats.totalKm).toLocaleString("fr-FR")} km` },
    { label: "Durée totale", value: `${stats.totalNights} nuits` },
    { label: "Budget prévisionnel", value: formatCurrency(budgetSummary?.total_planned ?? 0, referenceCurrency) },
    { label: "Empreinte carbone", value: `${stats.totalCo2.toLocaleString("fr-FR")} kg CO₂e` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3">
            <p className="text-lg font-bold leading-tight">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
