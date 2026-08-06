import { useMemo, useState } from "react";
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
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { estimateTransportLegCost } from "@/features/voyages/budget-estimate";
import { useCityLockedCostsMap, isLegacyLockedPlannedRow, type CityLockedCosts } from "@/features/voyages/use-city-locked-costs";
import { buildFlatRows, cascadeDatesFrom, type FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import { EditableExpenseAmount, ComputedCostAmount } from "@/features/voyages/editable-expense-amount";
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
 * confondre les deux dans la même case. Une colonne "locked" (avec `lockedField`) est calculée
 * à 100% côté client depuis `useCityLockedCostsMap`, jamais depuis une ligne `voyage_expenses` —
 * voir `cityColumnAmount` plus bas. */
type CityColumn = {
  key: string;
  label: string;
  category: ExpenseCategory;
  subCategory?: string;
  excludeSubCategories?: string[];
  locked?: boolean;
  lockedField?: keyof CityLockedCosts;
};

function matchesColumn(e: { category: ExpenseCategory; sub_category: string | null }, col: CityColumn): boolean {
  if (groupedCategory(e.category) !== col.category) return false;
  if (col.subCategory != null) return (e.sub_category ?? "") === col.subCategory;
  if (col.excludeSubCategories) return !col.excludeSubCategories.includes(e.sub_category ?? "");
  return true;
}

/** Montant d'UNE ville pour UNE colonne, côté Prévisionnel : pour une colonne verrouillée,
 * toujours la valeur calculée en direct (jamais une ligne voyage_expenses) ; sinon, la ligne
 * TROUVÉE pour cette ville/colonne (jamais une somme de toutes les lignes correspondantes) —
 * c'est exactement ce qui est affiché dans la case éditable, donc les totaux (pays, général) ne
 * peuvent jamais diverger de ce qui est visible à l'écran, même si d'anciennes lignes en double
 * traînent encore en base. */
function cityColumnAmount(col: CityColumn, cityRows: VoyageAllExpense[], locked: CityLockedCosts | undefined): number {
  if (col.locked && col.lockedField) return locked?.[col.lockedField] ?? 0;
  const row = cityRows.find((e) => matchesColumn(e, col));
  return row ? row.amount * row.manual_rate_to_reference : 0;
}

const CITY_COLUMNS: CityColumn[] = [
  { key: "transport", label: "Transport vers l'étape suivante", category: "transport", excludeSubCategories: ["sur_place"] },
  { key: "transport_local", label: "Transport sur place", category: "transport", subCategory: "sur_place", locked: true, lockedField: "localTransport" },
  { key: "logement", label: "Logement", category: "logement", locked: true, lockedField: "lodging" },
  { key: "nourriture", label: "Nourriture", category: "nourriture", locked: true, lockedField: "food" },
  { key: "activites", label: "Activités", category: "activites" },
];

// Le visa a sa propre estimation dans la fenêtre du pays (etape-dialog.tsx, rattachée à cette
// étape précise, pas au voyage) : exclu ici pour éviter la confusion avec les frais
// administratifs & santé transverses au voyage. "Autre" reste affiché : sans lui, d'éventuelles
// anciennes lignes (ex. catégories "administratif"/"financement" d'avant l'unification, qui se
// regroupent sous "autre") comptaient dans le total affiché sans jamais apparaître dans la
// grille, rendant ce total incompréhensible.
const ADMIN_SUB_COLUMNS = ADMIN_SANTE_SUB_CATEGORIES.filter((s) => s.value !== "visa");

type SelectedCell = { sousEtapeId: string; category: ExpenseCategory; subCategory?: string | null; label: string };

/**
 * Détail des dépenses : une ligne par VILLE (groupées par pays), une colonne par catégorie
 * (transport vers l'étape suivante, transport sur place, logement, nourriture, activités) — la
 * ligne du pays est un total calculé de ses villes, non modifiable (la source d'entrée, c'est la
 * ville). Équipement et administratif & santé, transverses au voyage, apparaissent en fin de
 * tableau. Bascule Prévisionnel/Réel : même forme des deux côtés pour rester comparable, mais
 * côté Prévisionnel, Transport sur place/Logement/Nourriture sont verrouillées — calculées à
 * 100% côté client (taux journalier x nombre de nuits, voir useCityLockedCostsMap), jamais
 * depuis une ligne `voyage_expenses` à resynchroniser : aucun délai de mise à jour possible,
 * quel que soit l'endroit où le nombre de nuits ou le taux a été modifié. Seuls Transport (vers
 * l'étape suivante) et Activités restent librement modifiables ici, comme toutes les cases côté
 * Réel.
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
  // Tant que cette requête n'a jamais chargé, `existing` (déduit de allExpenses) vaut undefined
  // parce qu'on n'a pas encore la réponse, PAS parce que la ligne n'existe pas : sans ce garde-
  // fou, EditableExpenseAmount créerait une ligne en double à chaque montage pendant le
  // chargement (observé : le nombre de doublons augmentait à chaque visite de l'onglet Budget).
  const expensesLoaded = allExpenses !== undefined;
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

  const { byCity: lockedByCity, total: lockedTotal } = useCityLockedCostsMap({
    etapes,
    sousEtapes: allSousEtapes,
    travelStyle,
    travelerCount,
    lodgingCount,
  });

  // L'équipement et les coûts verrouillés (logement/nourriture/transport sur place) ne sont
  // plus des lignes de dépense à resynchroniser : leur coût est calculé en direct à chaque
  // affichage, donc toujours à jour immédiatement. Les lignes correspondantes qui traînent
  // encore dans voyage_expenses (créées avant ce changement) sont exclues des totaux pour ne
  // pas compter en double.
  const expenses = (allExpenses ?? []).filter((e) => groupedCategory(e.category) !== "equipement" && !isLegacyLockedPlannedRow(e));
  const equipmentPlannedTotal = computeEquipmentPlannedTotal(equipmentItems ?? []);
  const totalPlanned =
    sumAmount(expenses.filter((e) => e.planned)) + equipmentPlannedTotal + lockedTotal.lodging + lockedTotal.food + lockedTotal.localTransport;
  const totalActual = sumAmount(expenses.filter((e) => !e.planned));
  const adminRows = expenses.filter((e) => e.voyage_id === voyageId && groupedCategory(e.category) === "administratif_sante");
  const adminPlannedTotal = sumAmount(adminRows.filter((e) => e.planned));

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
            <tr className="border-b border-border text-center text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left">Pays / ville</th>
              <th className="px-2 py-2">Nuits</th>
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
                voyageId={voyageId}
                travelerCount={travelerCount}
                referenceCurrency={referenceCurrency}
                flat={flat}
                lockedByCity={lockedByCity}
                dataReady={expensesLoaded}
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

        <div className="space-y-2 rounded-md border border-border/70 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Équipement</p>
            {view === "planned" && <span className="font-semibold">{formatCurrency(equipmentPlannedTotal, referenceCurrency)}</span>}
          </div>
          {view === "planned" ? (
            <p className="text-xs text-muted-foreground">Somme des articles à acheter, réglable dans l'onglet Équipement</p>
          ) : (
            <div className="space-y-2">
              <ExpenseFormDialog
                scope={{ voyageId }}
                categories={[{ value: "equipement", label: "Équipement" }]}
                referenceCurrency={referenceCurrency}
                invalidateKey={["voyage-all-expenses", voyageId]}
                projectId={projectId}
                defaultPlanned={false}
                lockPlanned
              />
              <ExpenseList
                expenses={(allExpenses ?? []).filter((e) => groupedCategory(e.category) === "equipement" && !e.planned)}
                invalidateKey={["voyage-all-expenses", voyageId]}
                projectId={projectId}
                categories={TRANSVERSE_CATEGORIES}
                referenceCurrency={referenceCurrency}
                lockPlanned
              />
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-border/70 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Administratif & santé</p>
            {view === "planned" && <span className="font-semibold">{formatCurrency(adminPlannedTotal, referenceCurrency)}</span>}
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
                      dataReady={expensesLoaded}
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
  voyageId,
  travelerCount,
  referenceCurrency,
  flat,
  lockedByCity,
  dataReady,
  updateSousEtape,
  onSelectCell,
}: {
  etape: VoyageEtape;
  cities: VoyageSousEtape[];
  expenses: VoyageAllExpense[];
  view: "planned" | "actual";
  voyageId: string;
  travelerCount: number;
  referenceCurrency: string;
  flat: FlatRow[];
  lockedByCity: Record<string, CityLockedCosts>;
  dataReady: boolean;
  updateSousEtape: ReturnType<typeof useUpdateSousEtape>;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const totalNights = cities.reduce((sum, c) => sum + (c.duration_days ?? 0), 0);

  // Côté Prévisionnel, le total par colonne d'un pays est la somme de ce qui est AFFICHÉ dans
  // chaque ville (cityColumnAmount) — jamais une somme indépendante de toutes les lignes en
  // base, qui pourrait diverger si d'anciennes lignes en double traînent encore. Côté Réel, les
  // cases sont déjà des boutons qui résument TOUTES les lignes correspondantes (voir
  // CityActualRow), donc sommer par ligne correspondante reste cohérent.
  const columnAmounts = CITY_COLUMNS.map((c) => {
    if (view === "planned") {
      return cities.reduce((sum, city) => {
        const cityRows = expenses.filter((e) => e.sous_etape_id === city.id && e.planned);
        return sum + cityColumnAmount(c, cityRows, lockedByCity[city.id]);
      }, 0);
    }
    return cities.reduce((sum, city) => {
      const cityRows = expenses.filter((e) => e.sous_etape_id === city.id && !e.planned);
      return sum + sumAmount(cityRows.filter((e) => matchesColumn(e, c)));
    }, 0);
  });
  const countryTotal = columnAmounts.reduce((a, b) => a + b, 0);

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
        {CITY_COLUMNS.map((c, i) => (
          <td key={c.key} className="px-2 py-2 text-center">
            {formatCurrency(columnAmounts[i], referenceCurrency)}
          </td>
        ))}
        <td className="border-l border-border bg-muted/20 px-3 py-2 text-right">{formatCurrency(countryTotal, referenceCurrency)}</td>
      </tr>
      {cities.map((se) =>
        view === "planned" ? (
          <CityPlannedRow
            key={se.id}
            se={se}
            rows={expenses.filter((e) => e.sous_etape_id === se.id && e.planned)}
            voyageId={voyageId}
            travelerCount={travelerCount}
            referenceCurrency={referenceCurrency}
            flat={flat}
            locked={lockedByCity[se.id]}
            dataReady={dataReady}
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
  rows,
  voyageId,
  travelerCount,
  referenceCurrency,
  flat,
  locked,
  dataReady,
  updateSousEtape,
}: {
  se: VoyageSousEtape;
  rows: VoyageAllExpense[];
  voyageId: string;
  travelerCount: number;
  referenceCurrency: string;
  flat: FlatRow[];
  locked: CityLockedCosts | undefined;
  dataReady: boolean;
  updateSousEtape: ReturnType<typeof useUpdateSousEtape>;
}) {
  // Calcul synchrone et pur (pas d'appel réseau) : toujours à jour au rendu, sans effet ni état
  // local à resynchroniser — la même fonction, avec les mêmes entrées, que celle utilisée dans
  // SousEtapeDialog, pour garantir une valeur identique partout où elle est affichée.
  const transportEstimate = estimateTransportLegCost(se.distance_km, se.transport_next_mode, travelerCount);
  const estimateFor: Record<string, number> = {
    transport: transportEstimate,
    activites: 0,
  };

  const total = CITY_COLUMNS.reduce((sum, c) => sum + cityColumnAmount(c, rows, locked), 0);
  const invalidateKey = ["voyage-all-expenses", voyageId];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-1.5 pl-8 text-muted-foreground">{se.city}</td>
      <td className="px-2 py-1.5 text-center">
        <NightsStepper se={se} flat={flat} updateSousEtape={updateSousEtape} />
      </td>
      {CITY_COLUMNS.map((c) =>
        c.locked ? (
          <td key={c.key} className="px-2 py-1.5 text-center">
            <ComputedCostAmount amount={cityColumnAmount(c, rows, locked)} className="mx-auto w-20 text-center" />
          </td>
        ) : (
          <td key={c.key} className="px-2 py-1.5 text-center">
            <EditableExpenseAmount
              scope={{ sousEtapeId: se.id }}
              category={c.category}
              subCategory={c.subCategory ?? (c.category === "transport" ? se.transport_next_mode : null)}
              planned
              existing={rows.find((e) => matchesColumn(e, c))}
              estimate={estimateFor[c.key]}
              referenceCurrency={referenceCurrency}
              invalidateKey={invalidateKey}
              dataReady={dataReady}
              className="mx-auto w-20 text-center"
            />
          </td>
        )
      )}
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
  const total = CITY_COLUMNS.reduce((sum, c) => sum + sumAmount(rows.filter((e) => matchesColumn(e, c))), 0);
  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-1.5 pl-8 text-muted-foreground">{se.city}</td>
      <td className="px-2 py-1.5 text-center">
        <NightsStepper se={se} flat={flat} updateSousEtape={updateSousEtape} />
      </td>
      {CITY_COLUMNS.map((c) => {
        const sum = sumAmount(rows.filter((e) => matchesColumn(e, c)));
        return (
          <td key={c.key} className="px-2 py-1.5 text-center">
            <button
              type="button"
              className="mx-auto w-20 rounded px-1.5 py-1 text-center text-sm underline decoration-dotted underline-offset-2 hover:bg-muted"
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
