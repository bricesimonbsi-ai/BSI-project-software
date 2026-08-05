import { useEffect, useMemo, useState } from "react";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  useVoyageAllExpenses,
  TRANSVERSE_CATEGORIES,
  ETAPE_CATEGORIES,
  groupedCategory,
  groupedSubCategory,
} from "@/features/voyages/use-expenses";
import { CountryFlag, findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { estimateEtapePlannedCosts, type EtapePlannedCosts } from "@/features/voyages/cost-of-living";
import { estimateVisaCostEur } from "@/features/voyages/budget-estimate";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { cn, formatCurrency } from "@/lib/utils";
import type { TravelStyle, VoyageAllExpense, VoyageEtape, VoyageSousEtape } from "@/types/database";

function sumAmount(rows: VoyageAllExpense[]): number {
  return rows.reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
}

/**
 * Détail des dépenses : bascule Prévisionnel (grille — une ligne par pays, une colonne par type
 * de dépense, chaque case pré-estimée et éditable) / Réel (listes détaillées par pays, saisies
 * au fil du voyage). Toutes deux lisent `voyage_all_expenses` avec la même normalisation de
 * catégorie que les graphiques au-dessus (`groupedCategory`/`groupedSubCategory`), donc les
 * chiffres coïncident toujours.
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
  const [view, setView] = useState<"planned" | "actual">("planned");

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
  const totalPlanned = sumAmount(expenses.filter((e) => e.planned));
  const totalActual = sumAmount(expenses.filter((e) => !e.planned));
  const equipmentRows = expenses.filter((e) => groupedCategory(e.category) === "equipement");
  const transverseAdminRows = expenses.filter(
    (e) => e.voyage_id === voyageId && groupedCategory(e.category) === "administratif_sante"
  );

  if (!etapes) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Détail des dépenses</h3>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView("planned")}
            className={cn("rounded px-3 py-1 text-xs font-medium", view === "planned" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
          >
            Prévisionnel
          </button>
          <button
            type="button"
            onClick={() => setView("actual")}
            className={cn("rounded px-3 py-1 text-xs font-medium", view === "actual" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
          >
            Réel
          </button>
        </div>
      </div>

      {view === "planned" ? (
        <PlannedGrid
          etapes={etapes}
          citiesByEtape={citiesByEtape}
          expenses={expenses}
          travelStyle={travelStyle}
          travelerCount={travelerCount}
          lodgingCount={lodgingCount}
          referenceCurrency={referenceCurrency}
          voyageId={voyageId}
          equipmentRow={equipmentRows.find((e) => e.planned)}
        />
      ) : (
        <div className="space-y-3">
          {etapes.map((etape) => (
            <div key={etape.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <CountryFlag name={etape.country_region} />
                  {etape.country_region}
                </span>
                <ExpenseFormDialog
                  scope={{ etapeId: etape.id }}
                  categories={ETAPE_CATEGORIES}
                  referenceCurrency={referenceCurrency}
                  invalidateKey={["voyage-all-expenses", voyageId]}
                  projectId={projectId}
                  defaultPlanned={false}
                />
              </div>
              <ExpenseList
                expenses={expenses.filter((e) => e.resolved_etape_id === etape.id && !e.planned)}
                invalidateKey={["voyage-all-expenses", voyageId]}
                projectId={projectId}
                categories={ETAPE_CATEGORIES}
                referenceCurrency={referenceCurrency}
              />
            </div>
          ))}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Équipement & administratif / santé</p>
                <p className="text-xs text-muted-foreground">Dépenses transverses, non propres à un pays.</p>
              </div>
              <ExpenseFormDialog
                scope={{ voyageId }}
                categories={TRANSVERSE_CATEGORIES}
                referenceCurrency={referenceCurrency}
                invalidateKey={["voyage-all-expenses", voyageId]}
                projectId={projectId}
                defaultPlanned={false}
              />
            </div>
            <ExpenseList
              expenses={[...equipmentRows, ...transverseAdminRows].filter((e) => !e.planned)}
              invalidateKey={["voyage-all-expenses", voyageId]}
              projectId={projectId}
              categories={TRANSVERSE_CATEGORIES}
              referenceCurrency={referenceCurrency}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-base font-bold">
        <span>TOTAL</span>
        <span>
          {formatCurrency(totalPlanned, referenceCurrency)} prévu · {formatCurrency(totalActual, referenceCurrency)} réel
        </span>
      </div>
    </div>
  );
}

const GRID_COLUMNS: { key: string; sub?: string; label: string }[] = [
  { key: "transport", label: "Transport" },
  { key: "logement", label: "Logement" },
  { key: "nourriture", label: "Nourriture" },
  { key: "activites", label: "Activités" },
  { key: "administratif_sante", sub: "visa", label: "Visa" },
  { key: "administratif_sante", sub: "assurance", label: "Assurance" },
  { key: "administratif_sante", sub: "vaccin", label: "Vaccins" },
  { key: "administratif_sante", sub: "frais_bancaires", label: "Frais bancaires" },
  { key: "administratif_sante", sub: "imprevus", label: "Imprévus" },
];

function PlannedGrid({
  etapes,
  citiesByEtape,
  expenses,
  travelStyle,
  travelerCount,
  lodgingCount,
  referenceCurrency,
  voyageId,
  equipmentRow,
}: {
  etapes: VoyageEtape[];
  citiesByEtape: Map<string, VoyageSousEtape[]>;
  expenses: VoyageAllExpense[];
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
  voyageId: string;
  equipmentRow: VoyageAllExpense | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Pays</th>
            {GRID_COLUMNS.map((c) => (
              <th key={c.key + (c.sub ?? "")} className="px-2 py-2">
                {c.label}
              </th>
            ))}
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {etapes.map((etape) => (
            <EtapeGridRow
              key={etape.id}
              etape={etape}
              cities={citiesByEtape.get(etape.id) ?? []}
              rows={expenses.filter((e) => e.resolved_etape_id === etape.id && e.planned)}
              travelStyle={travelStyle}
              travelerCount={travelerCount}
              lodgingCount={lodgingCount}
              referenceCurrency={referenceCurrency}
              voyageId={voyageId}
            />
          ))}
          <tr className="border-t border-border bg-muted/30">
            <td className="px-3 py-2 font-semibold">Équipement</td>
            <td className="px-2 py-2" colSpan={GRID_COLUMNS.length - 1}>
              <EditableExpenseAmount
                scope={{ voyageId }}
                category="equipement"
                planned
                existing={equipmentRow}
                estimate={null}
                referenceCurrency={referenceCurrency}
                invalidateKey={["voyage-all-expenses", voyageId]}
                className="w-28"
              />
              <span className="ml-2 text-xs text-muted-foreground">réglable aussi depuis l'onglet Équipement</span>
            </td>
            <td className="px-3 py-2 text-right font-semibold">
              {formatCurrency(equipmentRow ? equipmentRow.amount * equipmentRow.manual_rate_to_reference : 0, referenceCurrency)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EtapeGridRow({
  etape,
  cities,
  rows,
  travelStyle,
  travelerCount,
  lodgingCount,
  referenceCurrency,
  voyageId,
}: {
  etape: VoyageEtape;
  cities: VoyageSousEtape[];
  rows: VoyageAllExpense[];
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
  voyageId: string;
}) {
  const countryCode = findCountryByName(etape.country_region)?.cca2 ?? null;
  const [estimate, setEstimate] = useState<EtapePlannedCosts>({ transport: 0, lodging: 0, food: 0 });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const totalNights = cities.reduce((s, c) => s + (c.duration_days ?? 0), 0);
      const legs = cities.map((c) => ({ distanceKm: c.distance_km, mode: c.transport_next_mode }));
      const result = await estimateEtapePlannedCosts({
        totalNights,
        legs,
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
  }, [cities, countryCode, travelStyle, travelerCount, lodgingCount, etape.lodging_cost_per_night, etape.food_cost_per_day]);

  function findRow(key: string, sub?: string) {
    return rows.find((e) => groupedCategory(e.category) === key && (sub ? groupedSubCategory(e) === sub : true));
  }

  const estimateFor: Record<string, number | null> = {
    transport: estimate.transport,
    logement: estimate.lodging,
    nourriture: estimate.food,
    activites: null,
    visa: etape.visa_needed ? estimateVisaCostEur(travelStyle, travelerCount) : null,
    assurance: null,
    vaccin: null,
    frais_bancaires: null,
    imprevus: null,
  };

  const invalidateKey = ["voyage-all-expenses", voyageId];
  const total = sumAmount(rows);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <CountryFlag name={etape.country_region} />
          {etape.country_region}
        </span>
      </td>
      {GRID_COLUMNS.map((c) => {
        const estimateKey = c.sub ?? c.key;
        if (c.sub === "visa" && !etape.visa_needed) {
          return (
            <td key={c.key + (c.sub ?? "")} className="px-2 py-2 text-center text-muted-foreground">
              —
            </td>
          );
        }
        return (
          <td key={c.key + (c.sub ?? "")} className="px-2 py-2">
            <EditableExpenseAmount
              scope={{ etapeId: etape.id }}
              category={c.key as VoyageAllExpense["category"]}
              subCategory={c.sub ?? null}
              planned
              existing={findRow(c.key, c.sub)}
              estimate={estimateFor[estimateKey] ?? null}
              referenceCurrency={referenceCurrency}
              invalidateKey={invalidateKey}
              className="w-20"
            />
          </td>
        );
      })}
      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(total, referenceCurrency)}</td>
    </tr>
  );
}
