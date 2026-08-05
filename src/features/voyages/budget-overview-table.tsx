import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useVoyageAllExpenses, PRE_DEPARTURE_CATEGORIES } from "@/features/voyages/use-expenses";
import { CountryFlag, findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { estimateCityPlannedCosts, type CityPlannedCosts } from "@/features/voyages/cost-of-living";
import { estimateVisaCostEur } from "@/features/voyages/budget-estimate";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { formatCurrency } from "@/lib/utils";
import type { TravelStyle, VoyageAllExpense, VoyageEtape, VoyageSousEtape } from "@/types/database";

function sumAmount(rows: VoyageAllExpense[], planned: boolean): number {
  return rows.filter((e) => e.planned === planned).reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
}

/**
 * Vue d'ensemble éditable du budget prévisionnel et réel, ville par ville et pays par pays,
 * plus les dépenses transverses au voyage et une ligne de total. Chaque case éditable est
 * directement liée à une vraie ligne `voyage_expenses` (via `EditableExpenseAmount`), donc les
 * totaux affichés ici (et dans le reste de l'onglet Budget) reflètent toujours exactement ce qui
 * est saisi — plus aucun calcul parallèle qui pourrait diverger.
 */
export function BudgetOverviewTable({
  voyageId,
  projectId,
  referenceCurrency,
  travelStyle,
  travelerCount,
  lodgingCount,
}: {
  voyageId: string;
  projectId: string;
  referenceCurrency: string;
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
}) {
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);

  const citiesByEtape = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    return map;
  }, [allSousEtapes]);

  const expenses = allExpenses ?? [];
  const transverseExpenses = expenses.filter((e) => e.voyage_id === voyageId);
  const transversePlanned = sumAmount(transverseExpenses, true);
  const transverseActual = sumAmount(transverseExpenses, false);
  const totalPlanned = sumAmount(expenses, true);
  const totalActual = sumAmount(expenses, false);

  if (!etapes) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Vue d'ensemble du budget par ville et par pays (modifiable)
      </h3>
      {etapes.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border">
          {etapes.map((etape) => (
            <CountryBudgetSection
              key={etape.id}
              etape={etape}
              cities={citiesByEtape.get(etape.id) ?? []}
              allExpenses={expenses}
              travelStyle={travelStyle}
              travelerCount={travelerCount}
              lodgingCount={lodgingCount}
              referenceCurrency={referenceCurrency}
              voyageId={voyageId}
            />
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Dépenses transverses</p>
            <p className="text-xs text-muted-foreground">
              Équipement, assurance, vaccins, administratif, frais bancaires, financement... — pas propres à un pays.
            </p>
          </div>
          <ExpenseFormDialog
            scope={{ voyageId }}
            categories={PRE_DEPARTURE_CATEGORIES}
            referenceCurrency={referenceCurrency}
            invalidateKey={["voyage-all-expenses", voyageId]}
            projectId={projectId}
            defaultPlanned={true}
          />
        </div>
        <ExpenseList
          expenses={transverseExpenses}
          invalidateKey={["voyage-all-expenses", voyageId]}
          projectId={projectId}
          categories={PRE_DEPARTURE_CATEGORIES}
          referenceCurrency={referenceCurrency}
        />
        <div className="flex justify-end gap-4 text-sm">
          <span className="font-semibold">Sous-total transverse : {formatCurrency(transversePlanned, referenceCurrency)} prévu</span>
          <span className="text-muted-foreground">{formatCurrency(transverseActual, referenceCurrency)} réel</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-base font-bold">
        <span>TOTAL</span>
        <span>
          {formatCurrency(totalPlanned, referenceCurrency)} prévu · {formatCurrency(totalActual, referenceCurrency)} réel
        </span>
      </div>
    </div>
  );
}

function CountryBudgetSection({
  etape,
  cities,
  allExpenses,
  travelStyle,
  travelerCount,
  lodgingCount,
  referenceCurrency,
  voyageId,
}: {
  etape: VoyageEtape;
  cities: VoyageSousEtape[];
  allExpenses: VoyageAllExpense[];
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
  voyageId: string;
}) {
  const countryDirectRows = allExpenses.filter((e) => e.etape_id === etape.id);
  const cityIds = new Set(cities.map((c) => c.id));
  const cityRows = allExpenses.filter((e) => e.sous_etape_id && cityIds.has(e.sous_etape_id));
  const allCountryRows = [...countryDirectRows, ...cityRows];
  const plannedTotal = sumAmount(allCountryRows, true);
  const actualTotal = sumAmount(allCountryRows, false);
  const plannedVisa = countryDirectRows.find((e) => e.planned && e.category === "visas");

  if (cities.length === 0 && !etape.visa_needed) return null;

  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <CountryFlag name={etape.country_region} />
          {etape.country_region}
        </span>
        {etape.visa_needed && (
          <div className="flex items-center gap-2 text-xs">
            <Label className="font-normal text-muted-foreground">Visa (par pays)</Label>
            <EditableExpenseAmount
              scope={{ etapeId: etape.id }}
              category="visas"
              planned
              existing={plannedVisa}
              estimate={estimateVisaCostEur(travelStyle, travelerCount)}
              referenceCurrency={referenceCurrency}
              invalidateKey={["voyage-all-expenses", voyageId]}
              className="w-24"
            />
          </div>
        )}
      </div>
      {cities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-1.5">Ville</th>
                <th className="px-2 py-1.5 text-right">Nuits</th>
                <th className="px-2 py-1.5">Transport</th>
                <th className="px-2 py-1.5">Logement</th>
                <th className="px-2 py-1.5">Nourriture</th>
                <th className="px-2 py-1.5">Activités</th>
                <th className="px-3 py-1.5 text-right">Prévu</th>
                <th className="px-3 py-1.5 text-right">Réel</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((se) => (
                <CityBudgetRow
                  key={se.id}
                  se={se}
                  etape={etape}
                  travelStyle={travelStyle}
                  travelerCount={travelerCount}
                  lodgingCount={lodgingCount}
                  referenceCurrency={referenceCurrency}
                  allExpenses={allExpenses}
                  voyageId={voyageId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-4 text-sm">
        <span className="font-semibold">Sous-total pays : {formatCurrency(plannedTotal, referenceCurrency)} prévu</span>
        <span className="text-muted-foreground">{formatCurrency(actualTotal, referenceCurrency)} réel</span>
      </div>
    </div>
  );
}

function CityBudgetRow({
  se,
  etape,
  travelStyle,
  travelerCount,
  lodgingCount,
  referenceCurrency,
  allExpenses,
  voyageId,
}: {
  se: VoyageSousEtape;
  etape: VoyageEtape;
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
  allExpenses: VoyageAllExpense[];
  voyageId: string;
}) {
  const countryCode = findCountryByName(etape.country_region)?.cca2 ?? null;
  const [estimate, setEstimate] = useState<CityPlannedCosts>({ transport: 0, lodging: 0, food: 0 });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const result = await estimateCityPlannedCosts({
        nights: se.duration_days ?? 0,
        distanceKm: se.distance_km,
        transportMode: se.transport_next_mode,
        countryCode,
        style: travelStyle,
        travelerCount,
        lodgingCount,
        lodgingOverride: etape.lodging_cost_per_night,
        foodOverride: etape.food_cost_per_day,
      });
      if (!cancelled) setEstimate(result);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [
    se.duration_days,
    se.distance_km,
    se.transport_next_mode,
    countryCode,
    travelStyle,
    travelerCount,
    lodgingCount,
    etape.lodging_cost_per_night,
    etape.food_cost_per_day,
  ]);

  const cityRows = allExpenses.filter((e) => e.sous_etape_id === se.id);
  const plannedTransport = cityRows.find((e) => e.planned && e.category === "transport_local");
  const plannedLodging = cityRows.find((e) => e.planned && e.category === "logement");
  const plannedFood = cityRows.find((e) => e.planned && e.category === "nourriture");
  const plannedActivities = cityRows.find((e) => e.planned && e.category === "activites");
  const plannedRowTotal = sumAmount(cityRows, true);
  const actualRowTotal = sumAmount(cityRows, false);
  const invalidateKey = ["voyage-all-expenses", voyageId];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-2">{se.city}</td>
      <td className="px-2 py-2 text-right">{se.duration_days ?? 0}</td>
      <td className="px-2 py-2">
        <EditableExpenseAmount
          scope={{ sousEtapeId: se.id }}
          category="transport_local"
          planned
          existing={plannedTransport}
          estimate={estimate.transport}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          className="w-20"
        />
      </td>
      <td className="px-2 py-2">
        <EditableExpenseAmount
          scope={{ sousEtapeId: se.id }}
          category="logement"
          planned
          existing={plannedLodging}
          estimate={estimate.lodging}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          className="w-20"
        />
      </td>
      <td className="px-2 py-2">
        <EditableExpenseAmount
          scope={{ sousEtapeId: se.id }}
          category="nourriture"
          planned
          existing={plannedFood}
          estimate={estimate.food}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          className="w-20"
        />
      </td>
      <td className="px-2 py-2">
        <EditableExpenseAmount
          scope={{ sousEtapeId: se.id }}
          category="activites"
          planned
          existing={plannedActivities}
          estimate={null}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          className="w-20"
        />
      </td>
      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(plannedRowTotal, referenceCurrency)}</td>
      <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(actualRowTotal, referenceCurrency)}</td>
    </tr>
  );
}
