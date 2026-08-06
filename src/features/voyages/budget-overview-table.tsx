import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes, useUpdateSousEtape } from "@/features/voyages/use-sous-etapes";
import {
  useVoyageAllExpenses,
  TRANSVERSE_CATEGORIES,
  ADMIN_SANTE_SUB_CATEGORIES,
  groupedCategory,
} from "@/features/voyages/use-expenses";
import { useVoyageEquipment } from "@/features/voyages/use-voyage-equipment";
import { computeEquipmentPlannedTotal } from "@/features/voyages/equipment-pricing";
import { CountryFlag, findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { estimateCityPlannedCosts, type CityPlannedCosts } from "@/features/voyages/cost-of-living";
import { buildFlatRows, cascadeDatesFrom, type FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { ExpenseFormFields } from "@/features/voyages/expense-form-fields";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { cn, formatCurrency } from "@/lib/utils";
import type { ExpenseCategory, TravelStyle, VoyageAllExpense, VoyageEtape, VoyageSousEtape } from "@/types/database";

function sumAmount(rows: VoyageAllExpense[]): number {
  return rows.reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
}

/** Le trajet vers la ville suivante et le transport sur place partagent la même catégorie
 * unifiée "transport" mais pas le même sub_category (voir sous-etape-dialog.tsx) : chaque
 * colonne précise explicitement quel sub_category elle représente (ou exclut) pour ne jamais
 * confondre les deux dans la même case. Une colonne "locked" est calculée automatiquement
 * (taux journalier x nuits, voir SousEtapeDialog) et non éditable directement dans ce tableau. */
type CityColumn = {
  key: string;
  label: string;
  category: ExpenseCategory;
  subCategory?: string;
  excludeSubCategories?: string[];
  locked?: boolean;
};

function matchesColumn(e: { category: ExpenseCategory; sub_category: string | null }, col: CityColumn): boolean {
  if (groupedCategory(e.category) !== col.category) return false;
  if (col.subCategory != null) return (e.sub_category ?? "") === col.subCategory;
  if (col.excludeSubCategories) return !col.excludeSubCategories.includes(e.sub_category ?? "");
  return true;
}

/** Total d'une ligne = somme des colonnes réellement affichées (jamais un total "à côté"
 * calculé indépendamment) : garantit par construction qu'il ne peut jamais diverger de ce qui
 * est visible à l'écran, même si d'anciennes lignes en double existent pour une catégorie. */
function sumByColumns(rows: VoyageAllExpense[]): number {
  return CITY_COLUMNS.reduce((sum, c) => sum + sumAmount(rows.filter((e) => matchesColumn(e, c))), 0);
}

const CITY_COLUMNS: CityColumn[] = [
  { key: "transport", label: "Transport", category: "transport", excludeSubCategories: ["sur_place"] },
  { key: "transport_local", label: "Transport sur place", category: "transport", subCategory: "sur_place", locked: true },
  { key: "logement", label: "Logement", category: "logement", locked: true },
  { key: "nourriture", label: "Nourriture", category: "nourriture", locked: true },
  { key: "activites", label: "Activités", category: "activites" },
];

const ADMIN_SUB_COLUMNS = ADMIN_SANTE_SUB_CATEGORIES.filter((s) => s.value !== "visa" && s.value !== "autre");

type SelectedCell = { sousEtapeId: string; category: ExpenseCategory; subCategory?: string | null; label: string };

/**
 * Détail des dépenses : une ligne par VILLE (groupées par pays), une colonne par catégorie
 * (transport, transport sur place, logement, nourriture, activités) — la ligne du pays est un
 * total calculé de ses villes, non modifiable (la source d'entrée, c'est la ville). Équipement
 * et administratif & santé, transverses au voyage, apparaissent en fin de tableau. Bascule
 * Prévisionnel/Réel : même forme des deux côtés pour rester comparable, mais côté Prévisionnel,
 * Transport sur place/Logement/Nourriture sont verrouillées (calculées automatiquement depuis
 * le taux journalier x le nombre de nuits, ajustables uniquement via SousEtapeDialog ou le
 * compteur de nuits ci-dessous) — seuls Transport (trajet) et Activités restent librement
 * modifiables ici, comme toutes les cases côté Réel. Chaque case est une vraie ligne
 * `voyage_expenses`, la même que celle modifiable depuis le dialogue de la ville correspondante
 * — éditer d'un côté (quand ce n'est pas verrouillé) met donc toujours à jour l'autre.
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
  const { data: equipmentItems } = useVoyageEquipment(voyageId);
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

  // Réutilise exactement la même logique de cascade que l'onglet Itinéraire (voir
  // ItineraryView) pour le compteur de nuits ci-dessous : ajuster les nuits d'une ville
  // recalcule les dates de toutes les suivantes, ici aussi.
  const flat = useMemo(() => buildFlatRows(etapes ?? [], citiesByEtape), [etapes, citiesByEtape]);
  const updateSousEtape = useUpdateSousEtape(voyageId);

  // L'équipement n'est plus une ligne de dépense séparée à resynchroniser : son coût est
  // calculé en direct depuis l'onglet Équipement à chaque affichage, donc toujours à jour
  // immédiatement (pas besoin de revenir sur cet onglet pour que le total se propage). Les
  // catégories "equipement" restantes dans voyage_expenses (anciennes lignes synchronisées
  // avant ce changement) sont donc exclues des totaux pour ne pas compter en double.
  const expenses = (allExpenses ?? []).filter((e) => groupedCategory(e.category) !== "equipement");
  const equipmentPlannedTotal = computeEquipmentPlannedTotal(equipmentItems ?? []);
  const totalPlanned = sumAmount(expenses.filter((e) => e.planned)) + equipmentPlannedTotal;
  const totalActual = sumAmount(expenses.filter((e) => !e.planned));
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
              <th className="px-2 py-2 text-center">Nuits</th>
              {CITY_COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              <th className="border-l border-border px-3 py-2 text-right">Total</th>
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
                flat={flat}
                updateSousEtape={updateSousEtape}
                onSelectCell={setSelectedCell}
              />
            ))}
          </tbody>
        </table>
      </div>

      {view === "actual" && (
        <Dialog open={selectedCell !== null} onOpenChange={(o) => !o && setSelectedCell(null)}>
          <DialogContent>
            {selectedCell && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedCell.label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <ExpenseList
                    expenses={expenses.filter(
                      (e) =>
                        e.sous_etape_id === selectedCell.sousEtapeId &&
                        !e.planned &&
                        matchesColumn(e, {
                          key: "selected",
                          label: "",
                          category: selectedCell.category,
                          subCategory: selectedCell.subCategory ?? undefined,
                          excludeSubCategories: selectedCell.subCategory ? undefined : ["sur_place"],
                        })
                    )}
                    invalidateKey={["voyage-all-expenses", voyageId]}
                    projectId={projectId}
                    categories={[{ value: selectedCell.category, label: selectedCell.label }]}
                    referenceCurrency={referenceCurrency}
                    lockPlanned
                  />
                  <ExpenseFormFields
                    scope={{ sousEtapeId: selectedCell.sousEtapeId }}
                    categories={[{ value: selectedCell.category, label: selectedCell.label }]}
                    referenceCurrency={referenceCurrency}
                    invalidateKey={["voyage-all-expenses", voyageId]}
                    projectId={projectId}
                    defaultPlanned={false}
                    defaultSubCategory={selectedCell.subCategory ?? undefined}
                    lockPlanned
                    onDone={() => {}}
                  />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dépenses transverses (pas propres à un pays)
        </p>

        {view === "planned" && (
          <div className="space-y-2 rounded-md border border-border/70 p-2.5">
            <p className="text-sm font-semibold">Équipement</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-xs text-muted-foreground">Somme des articles à acheter (voir l'onglet Équipement)</span>
              <span>
                <span className="font-semibold">{formatCurrency(equipmentPlannedTotal, referenceCurrency)}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">réglable dans l'onglet Équipement</span>
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-md border border-border/70 p-2.5">
          <p className="text-sm font-semibold">Administratif & santé</p>
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
                categories={[{ value: "administratif_sante", label: "Administratif & santé" }]}
                referenceCurrency={referenceCurrency}
                invalidateKey={["voyage-all-expenses", voyageId]}
                projectId={projectId}
                defaultPlanned={false}
                lockPlanned
              />
              <ExpenseList
                expenses={adminRows.filter((e) => !e.planned)}
                invalidateKey={["voyage-all-expenses", voyageId]}
                projectId={projectId}
                categories={TRANSVERSE_CATEGORIES}
                referenceCurrency={referenceCurrency}
                lockPlanned
              />
            </div>
          )}
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
  flat,
  updateSousEtape,
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
  flat: FlatRow[];
  updateSousEtape: ReturnType<typeof useUpdateSousEtape>;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const cityIds = new Set(cities.map((c) => c.id));
  const countryRows = expenses.filter((e) => e.sous_etape_id && cityIds.has(e.sous_etape_id) && e.planned === (view === "planned"));
  const countryTotal = sumByColumns(countryRows);
  const totalNights = cities.reduce((sum, c) => sum + (c.duration_days ?? 0), 0);

  return (
    <>
      <tr className="border-b border-border bg-muted/30 font-semibold">
        <td className="whitespace-nowrap px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <CountryFlag name={etape.country_region} />
            {etape.country_region}
          </span>
        </td>
        <td className="px-2 py-2 text-center">{totalNights}</td>
        {CITY_COLUMNS.map((c) => (
          <td key={c.key} className="px-2 py-2 text-right">
            {formatCurrency(sumAmount(countryRows.filter((e) => matchesColumn(e, c))), referenceCurrency)}
          </td>
        ))}
        <td className="border-l border-border bg-muted/20 px-3 py-2 text-right">{formatCurrency(countryTotal, referenceCurrency)}</td>
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
            flat={flat}
            updateSousEtape={updateSousEtape}
          />
        ) : (
          <CityActualRow
            key={se.id}
            se={se}
            rows={expenses.filter((e) => e.sous_etape_id === se.id && !e.planned)}
            referenceCurrency={referenceCurrency}
            flat={flat}
            updateSousEtape={updateSousEtape}
            onSelectCell={onSelectCell}
          />
        )
      )}
    </>
  );
}

/** Compteur de nuits identique à celui de l'onglet Itinéraire (mêmes +/-, même recalcul en
 * cascade des dates des villes suivantes via cascadeDatesFrom) : éditable ici aussi, pour ne
 * pas obliger un aller-retour vers l'itinéraire juste pour ajuster une durée de séjour. */
function NightsStepper({
  se,
  flat,
  updateSousEtape,
}: {
  se: VoyageSousEtape;
  flat: FlatRow[];
  updateSousEtape: ReturnType<typeof useUpdateSousEtape>;
}) {
  async function handleChange(delta: number) {
    const newDuration = Math.max(0, (se.duration_days ?? 0) + delta);
    const updates = cascadeDatesFrom(flat, se.id, { duration_days: newDuration });
    for (const u of updates) {
      await updateSousEtape.mutateAsync({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
    }
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
      <button
        type="button"
        onClick={() => handleChange(-1)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-xs font-bold"
      >
        −
      </button>
      <span className="min-w-[1.5rem] text-center text-xs font-semibold">{se.duration_days ?? 0}</span>
      <button
        type="button"
        onClick={() => handleChange(1)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-xs font-bold"
      >
        +
      </button>
    </span>
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
  flat,
  updateSousEtape,
}: {
  se: VoyageSousEtape;
  etape: VoyageEtape;
  rows: VoyageAllExpense[];
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  referenceCurrency: string;
  voyageId: string;
  flat: FlatRow[];
  updateSousEtape: ReturnType<typeof useUpdateSousEtape>;
}) {
  const countryCode = findCountryByName(etape.country_region)?.cca2 ?? null;
  const [estimate, setEstimate] = useState<CityPlannedCosts>({
    transport: 0,
    lodging: 0,
    food: 0,
    localTransport: 0,
    rates: { lodging: 0, food: 0, localTransport: 0 },
  });

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
        localTransportOverride: etape.local_transport_cost_per_day,
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
    etape.local_transport_cost_per_day,
  ]);

  const estimateFor: Record<string, number> = {
    transport: estimate.transport,
    transport_local: estimate.localTransport,
    nourriture: estimate.food,
    logement: estimate.lodging,
    activites: 0,
  };

  const total = sumByColumns(rows);
  const invalidateKey = ["voyage-all-expenses", voyageId];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-1.5 pl-8 text-muted-foreground">{se.city}</td>
      <td className="px-2 py-1.5 text-center">
        <NightsStepper se={se} flat={flat} updateSousEtape={updateSousEtape} />
      </td>
      {CITY_COLUMNS.map((c) => (
        <td key={c.key} className="px-2 py-1.5">
          <EditableExpenseAmount
            scope={{ sousEtapeId: se.id }}
            category={c.category}
            subCategory={c.subCategory ?? (c.category === "transport" ? se.transport_next_mode : null)}
            planned
            existing={rows.find((e) => matchesColumn(e, c))}
            estimate={estimateFor[c.key]}
            referenceCurrency={referenceCurrency}
            invalidateKey={invalidateKey}
            className="w-20"
            readOnly={c.locked}
          />
        </td>
      ))}
      <td className="border-l border-border bg-muted/10 px-3 py-1.5 text-right font-medium">{formatCurrency(total, referenceCurrency)}</td>
    </tr>
  );
}

function CityActualRow({
  se,
  rows,
  referenceCurrency,
  flat,
  updateSousEtape,
  onSelectCell,
}: {
  se: VoyageSousEtape;
  rows: VoyageAllExpense[];
  referenceCurrency: string;
  flat: FlatRow[];
  updateSousEtape: ReturnType<typeof useUpdateSousEtape>;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const total = sumByColumns(rows);
  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-1.5 pl-8 text-muted-foreground">{se.city}</td>
      <td className="px-2 py-1.5 text-center">
        <NightsStepper se={se} flat={flat} updateSousEtape={updateSousEtape} />
      </td>
      {CITY_COLUMNS.map((c) => {
        const sum = sumAmount(rows.filter((e) => matchesColumn(e, c)));
        return (
          <td key={c.key} className="px-2 py-1.5">
            <button
              type="button"
              className="w-20 rounded px-1.5 py-1 text-right text-sm underline decoration-dotted underline-offset-2 hover:bg-muted"
              onClick={() => onSelectCell({ sousEtapeId: se.id, category: c.category, subCategory: c.subCategory ?? null, label: `${se.city} · ${c.label}` })}
            >
              {formatCurrency(sum, referenceCurrency)}
            </button>
          </td>
        );
      })}
      <td className="border-l border-border bg-muted/10 px-3 py-1.5 text-right font-medium">{formatCurrency(total, referenceCurrency)}</td>
    </tr>
  );
}
