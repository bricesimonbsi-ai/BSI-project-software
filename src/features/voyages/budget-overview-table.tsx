import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  useVoyageAllExpenses,
  TRANSVERSE_CATEGORIES,
  ADMIN_SANTE_SUB_CATEGORIES,
  groupedCategory,
} from "@/features/voyages/use-expenses";
import { CountryFlag, findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { estimateCityPlannedCosts, type CityPlannedCosts } from "@/features/voyages/cost-of-living";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { cn, formatCurrency } from "@/lib/utils";
import type { ExpenseCategory, TravelStyle, VoyageAllExpense, VoyageEtape, VoyageSousEtape } from "@/types/database";

function sumAmount(rows: VoyageAllExpense[]): number {
  return rows.reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
}

const CITY_COLUMNS: { key: ExpenseCategory; label: string }[] = [
  { key: "transport", label: "Transport" },
  { key: "nourriture", label: "Nourriture" },
  { key: "logement", label: "Logement" },
  { key: "activites", label: "Activités" },
];

const ADMIN_SUB_COLUMNS = ADMIN_SANTE_SUB_CATEGORIES.filter((s) => s.value !== "visa" && s.value !== "autre");

type SelectedCell = { sousEtapeId: string; category: ExpenseCategory; label: string };

/**
 * Détail des dépenses : une ligne par VILLE (groupées par pays), une colonne par catégorie
 * (transport, nourriture, logement, activités) — la ligne du pays est un total calculé de ses
 * villes, non modifiable (la source d'entrée, c'est la ville). Équipement et administratif &
 * santé, transverses au voyage, apparaissent en fin de tableau. Bascule Prévisionnel/Réel :
 * même forme des deux côtés pour rester comparable. Chaque case éditable est une vraie ligne
 * `voyage_expenses`, la même que celle modifiable depuis le dialogue de la ville correspondante
 * — éditer d'un côté met donc toujours à jour l'autre.
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
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

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
  const adminRows = expenses.filter((e) => e.voyage_id === voyageId && groupedCategory(e.category) === "administratif_sante");

  if (!etapes) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Détail des dépenses</h3>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => {
              setView("planned");
              setSelectedCell(null);
            }}
            className={cn("rounded px-3 py-1 text-xs font-medium", view === "planned" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
          >
            Prévisionnel
          </button>
          <button
            type="button"
            onClick={() => {
              setView("actual");
              setSelectedCell(null);
            }}
            className={cn("rounded px-3 py-1 text-xs font-medium", view === "actual" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
          >
            Réel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Pays / ville</th>
              {CITY_COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {etapes.map((etape) => (
              <CountrySection
                key={etape.id}
                etape={etape}
                cities={citiesByEtape.get(etape.id) ?? []}
                expenses={expenses}
                view={view}
                travelStyle={travelStyle}
                travelerCount={travelerCount}
                lodgingCount={lodgingCount}
                referenceCurrency={referenceCurrency}
                voyageId={voyageId}
                onSelectCell={setSelectedCell}
              />
            ))}
          </tbody>
        </table>
      </div>

      {view === "actual" && selectedCell && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{selectedCell.label}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedCell(null)}>
              Fermer
            </Button>
          </div>
          <ExpenseList
            expenses={expenses.filter(
              (e) => e.sous_etape_id === selectedCell.sousEtapeId && !e.planned && groupedCategory(e.category) === selectedCell.category
            )}
            invalidateKey={["voyage-all-expenses", voyageId]}
            projectId={projectId}
            categories={[{ value: selectedCell.category, label: selectedCell.label }]}
            referenceCurrency={referenceCurrency}
          />
          <ExpenseFormDialog
            scope={{ sousEtapeId: selectedCell.sousEtapeId }}
            categories={[{ value: selectedCell.category, label: selectedCell.label }]}
            referenceCurrency={referenceCurrency}
            invalidateKey={["voyage-all-expenses", voyageId]}
            projectId={projectId}
            defaultPlanned={false}
          />
        </div>
      )}

      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dépenses transverses (équipement, administratif & santé — pas propres à un pays)
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Équipement</span>
          <span>
            <span className="font-semibold">{formatCurrency(sumAmount(equipmentRows.filter((e) => e.planned === (view === "planned"))), referenceCurrency)}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">réglable dans l'onglet Équipement</span>
          </span>
        </div>
        {view === "planned" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ADMIN_SUB_COLUMNS.map((s) => {
              const row = adminRows.find((e) => e.planned && (e.sub_category || "") === s.value);
              return (
                <div key={s.value} className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">{s.label}</Label>
                  <EditableExpenseAmount
                    scope={{ voyageId }}
                    category="administratif_sante"
                    subCategory={s.value}
                    planned
                    existing={row}
                    estimate={null}
                    referenceCurrency={referenceCurrency}
                    invalidateKey={["voyage-all-expenses", voyageId]}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <ExpenseFormDialog
              scope={{ voyageId }}
              categories={TRANSVERSE_CATEGORIES}
              referenceCurrency={referenceCurrency}
              invalidateKey={["voyage-all-expenses", voyageId]}
              projectId={projectId}
              defaultPlanned={false}
            />
            <ExpenseList
              expenses={adminRows.filter((e) => !e.planned)}
              invalidateKey={["voyage-all-expenses", voyageId]}
              projectId={projectId}
              categories={TRANSVERSE_CATEGORIES}
              referenceCurrency={referenceCurrency}
            />
          </div>
        )}
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

function CountrySection({
  etape,
  cities,
  expenses,
  view,
  travelStyle,
  travelerCount,
  lodgingCount,
  referenceCurrency,
  voyageId,
  onSelectCell,
}: {
  etape: VoyageEtape;
  cities: VoyageSousEtape[];
  expenses: VoyageAllExpense[];
  view: "planned" | "actual";
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
  voyageId: string;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const cityIds = new Set(cities.map((c) => c.id));
  const countryRows = expenses.filter((e) => e.sous_etape_id && cityIds.has(e.sous_etape_id) && e.planned === (view === "planned"));
  const countryTotal = sumAmount(countryRows);

  return (
    <>
      <tr className="border-b border-border bg-muted/30 font-semibold">
        <td className="whitespace-nowrap px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <CountryFlag name={etape.country_region} />
            {etape.country_region}
          </span>
        </td>
        {CITY_COLUMNS.map((c) => (
          <td key={c.key} className="px-2 py-2 text-right">
            {formatCurrency(sumAmount(countryRows.filter((e) => groupedCategory(e.category) === c.key)), referenceCurrency)}
          </td>
        ))}
        <td className="px-3 py-2 text-right">{formatCurrency(countryTotal, referenceCurrency)}</td>
      </tr>
      {cities.map((se) =>
        view === "planned" ? (
          <CityPlannedRow
            key={se.id}
            se={se}
            etape={etape}
            rows={expenses.filter((e) => e.sous_etape_id === se.id && e.planned)}
            travelStyle={travelStyle}
            travelerCount={travelerCount}
            lodgingCount={lodgingCount}
            referenceCurrency={referenceCurrency}
            voyageId={voyageId}
          />
        ) : (
          <CityActualRow
            key={se.id}
            se={se}
            rows={expenses.filter((e) => e.sous_etape_id === se.id && !e.planned)}
            referenceCurrency={referenceCurrency}
            onSelectCell={onSelectCell}
          />
        )
      )}
    </>
  );
}

function CityPlannedRow({
  se,
  etape,
  rows,
  travelStyle,
  travelerCount,
  lodgingCount,
  referenceCurrency,
  voyageId,
}: {
  se: VoyageSousEtape;
  etape: VoyageEtape;
  rows: VoyageAllExpense[];
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
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
  }, [se.duration_days, se.distance_km, se.transport_next_mode, countryCode, travelStyle, travelerCount, lodgingCount, etape.lodging_cost_per_night, etape.food_cost_per_day]);

  const estimateFor: Record<string, number> = {
    transport: estimate.transport,
    nourriture: estimate.food,
    logement: estimate.lodging,
    activites: 0,
  };

  function findRow(cat: ExpenseCategory) {
    return rows.find((e) => groupedCategory(e.category) === cat);
  }

  const total = sumAmount(rows);
  const invalidateKey = ["voyage-all-expenses", voyageId];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-1.5 pl-8 text-muted-foreground">{se.city}</td>
      {CITY_COLUMNS.map((c) => (
        <td key={c.key} className="px-2 py-1.5">
          <EditableExpenseAmount
            scope={{ sousEtapeId: se.id }}
            category={c.key}
            subCategory={c.key === "transport" ? se.transport_next_mode : null}
            planned
            existing={findRow(c.key)}
            estimate={estimateFor[c.key]}
            referenceCurrency={referenceCurrency}
            invalidateKey={invalidateKey}
            className="w-20"
          />
        </td>
      ))}
      <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(total, referenceCurrency)}</td>
    </tr>
  );
}

function CityActualRow({
  se,
  rows,
  referenceCurrency,
  onSelectCell,
}: {
  se: VoyageSousEtape;
  rows: VoyageAllExpense[];
  referenceCurrency: string;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const total = sumAmount(rows);
  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-1.5 pl-8 text-muted-foreground">{se.city}</td>
      {CITY_COLUMNS.map((c) => {
        const sum = sumAmount(rows.filter((e) => groupedCategory(e.category) === c.key));
        return (
          <td key={c.key} className="px-2 py-1.5">
            <button
              type="button"
              className="w-20 rounded px-1.5 py-1 text-right text-sm underline decoration-dotted underline-offset-2 hover:bg-muted"
              onClick={() => onSelectCell({ sousEtapeId: se.id, category: c.key, label: `${se.city} · ${c.label}` })}
            >
              {formatCurrency(sum, referenceCurrency)}
            </button>
          </td>
        );
      })}
      <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(total, referenceCurrency)}</td>
    </tr>
  );
}
