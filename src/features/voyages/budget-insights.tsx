import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useTravelers } from "@/features/voyages/use-travelers";
import {
  useVoyageBudgetSummary,
  useVoyageCategoryBudgetSummary,
  useVoyageTravelerExpenseSummary,
  useCreateExpense,
  PRE_DEPARTURE_CATEGORIES,
  ON_SITE_CATEGORIES,
} from "@/features/voyages/use-expenses";
import { buildFlatRows } from "@/features/voyages/itinerary/itinerary-model";
import { estimateBudget, TRAVEL_STYLE_OPTIONS } from "@/features/voyages/budget-estimate";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { ExpenseCategory, TravelStyle, Voyage, VoyageSousEtape } from "@/types/database";
import { Sparkles } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...PRE_DEPARTURE_CATEGORIES, ...ON_SITE_CATEGORIES].map((c) => [c.value, c.label])
);

/** Indicateurs budget (total, par personne, par catégorie) + estimation indicative à partir
 * de l'itinéraire, dans l'onglet Budget. */
export function BudgetInsights({ voyage }: { voyage: Voyage }) {
  const voyageId = voyage.id;
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const { data: travelers } = useTravelers(voyageId);
  const { data: budgetSummary } = useVoyageBudgetSummary(voyageId);
  const { data: categorySummary } = useVoyageCategoryBudgetSummary(voyageId);
  const { data: travelerSummary } = useVoyageTravelerExpenseSummary(voyageId);
  const createExpense = useCreateExpense({ voyageId }, ["voyage-expenses", voyageId]);
  const [style, setStyle] = useState<TravelStyle>(voyage.travel_style ?? "standard");
  const [adding, setAdding] = useState(false);

  const travelerCount = travelers?.length || voyage.adults_count + voyage.children_count || 1;

  const itineraryStats = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    const flat = buildFlatRows(etapes ?? [], map);
    const totalNights = flat.reduce((sum, r) => sum + (r.sousEtape.duration_days ?? 0), 0);
    const flightKm = flat.reduce(
      (sum, r) => sum + (r.incomingMode?.toLowerCase().includes("avion") ? r.incomingDistanceKm ?? 0 : 0),
      0
    );
    const visaEtapeCount = (etapes ?? []).filter((e) => e.visa_needed).length;
    return { totalNights, flightKm, visaEtapeCount };
  }, [etapes, allSousEtapes]);

  const estimate = estimateBudget({
    totalNights: itineraryStats.totalNights,
    travelerCount,
    lodgingCount: voyage.lodging_count ?? travelerCount,
    flightKm: itineraryStats.flightKm,
    visaEtapeCount: itineraryStats.visaEtapeCount,
    style,
  });

  async function handleAddEstimateToBudget() {
    setAdding(true);
    try {
      const allLines: { category: ExpenseCategory; amount: number; description: string }[] = [
        { category: "logement", amount: estimate.lodging, description: "Estimation hébergement (auto)" },
        { category: "nourriture", amount: estimate.food, description: "Estimation nourriture (auto)" },
        { category: "transport_international", amount: estimate.flights, description: "Estimation vols inter-étapes (auto)" },
        { category: "visas", amount: estimate.visas, description: "Estimation visas (auto)" },
      ];
      const lines = allLines.filter((l) => l.amount > 0);
      for (const line of lines) {
        await createExpense.mutateAsync({
          category: line.category,
          planned: true,
          amount: Math.round(line.amount),
          currency: "EUR",
          manual_rate_to_reference: 1,
          description: line.description,
        });
      }
      toast({
        title: "Estimation ajoutée au budget prévisionnel",
        description:
          voyage.reference_currency !== "EUR"
            ? "Ajoutée en EUR — ajuste le taux si ta devise de référence est différente."
            : undefined,
      });
    } finally {
      setAdding(false);
    }
  }

  const totalPlanned = budgetSummary?.total_planned ?? 0;
  const perPersonPlanned = totalPlanned / travelerCount;

  const categoryRows = (categorySummary ?? [])
    .map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] ?? c.category }))
    .sort((a, b) => (b.total_planned ?? 0) - (a.total_planned ?? 0));
  const maxCategoryTotal = Math.max(1, ...categoryRows.map((c) => c.total_planned ?? 0));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">{formatCurrency(totalPlanned, voyage.reference_currency)}</p>
            <p className="text-xs text-muted-foreground">Budget prévisionnel total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">{formatCurrency(budgetSummary?.total_actual ?? 0, voyage.reference_currency)}</p>
            <p className="text-xs text-muted-foreground">Dépenses réelles totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">
              {formatCurrency(perPersonPlanned, voyage.reference_currency)}
              {voyage.budget_target_per_person ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / cible {formatCurrency(voyage.budget_target_per_person, voyage.reference_currency)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">Budget prévisionnel / personne ({travelerCount})</p>
          </CardContent>
        </Card>
      </div>

      {categoryRows.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Par grande catégorie (prévisionnel)
          </h3>
          <div className="space-y-2">
            {categoryRows.map((c) => (
              <div key={c.category} className="flex items-center gap-3 text-sm">
                <span className="w-40 flex-shrink-0 truncate">{c.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${((c.total_planned ?? 0) / maxCategoryTotal) * 100}%` }}
                  />
                </div>
                <span className="w-24 flex-shrink-0 text-right font-semibold">
                  {formatCurrency(c.total_planned ?? 0, voyage.reference_currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {travelerSummary && travelerSummary.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dépenses rattachées à une personne
          </h3>
          <div className="space-y-1">
            {travelerSummary.map((t) => (
              <div key={t.traveler_id} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="font-semibold">
                  {formatCurrency(t.total_planned ?? 0, voyage.reference_currency)} prévu ·{" "}
                  {formatCurrency(t.total_actual ?? 0, voyage.reference_currency)} réel
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Estimation indicative à partir de l'itinéraire</p>
            <Select value={style} onValueChange={(v) => setStyle(v as TravelStyle)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAVEL_STYLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Hébergement</p>
              <p className="font-semibold">{formatCurrency(estimate.lodging, "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nourriture</p>
              <p className="font-semibold">{formatCurrency(estimate.food, "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vols inter-étapes</p>
              <p className="font-semibold">{formatCurrency(estimate.flights, "EUR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visas</p>
              <p className="font-semibold">{formatCurrency(estimate.visas, "EUR")}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Basé sur des tarifs forfaitaires par style de voyage (aucune source de coût de la vie en temps réel) — toujours en
            EUR, à ajuster. N'inclut ni activités ni imprévus, pas estimables automatiquement.
          </p>
          <Button type="button" size="sm" onClick={handleAddEstimateToBudget} disabled={adding || estimate.total === 0}>
            <Sparkles className="mr-1.5 h-4 w-4" /> {adding ? "Ajout..." : "Ajouter au budget prévisionnel"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
