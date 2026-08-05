import { useState } from "react";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageAllExpenses, ETAPE_CATEGORIES, TRANSVERSE_CATEGORIES } from "@/features/voyages/use-expenses";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { cn, formatCurrency } from "@/lib/utils";
import type { VoyageAllExpense, VoyageEtape } from "@/types/database";

function sumAmount(rows: VoyageAllExpense[]): number {
  return rows.reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
}

/**
 * Détail des dépenses par pays (transport/logement/nourriture/activités, y compris celles
 * saisies au niveau d'une ville) + dépenses transverses (équipement, administratif & santé),
 * avec un bascule prévisionnel/réel et une ligne de total. Chaque dépense affichée est une
 * vraie ligne `voyage_expenses` (jamais une estimation flottante) : c'est la même source de
 * données que les graphiques au-dessus, donc les deux coïncident toujours.
 */
export function BudgetOverviewTable({
  voyageId,
  projectId,
  referenceCurrency,
}: {
  voyageId: string;
  projectId: string;
  referenceCurrency: string;
}) {
  const { data: etapes } = useEtapes(voyageId);
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);
  const [view, setView] = useState<"planned" | "actual">("planned");

  const expenses = allExpenses ?? [];
  const totalPlanned = sumAmount(expenses.filter((e) => e.planned));
  const totalActual = sumAmount(expenses.filter((e) => !e.planned));
  const transverseRows = expenses.filter((e) => e.voyage_id === voyageId && e.planned === (view === "planned"));

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

      <div className="space-y-3">
        {etapes.map((etape) => (
          <EtapeExpenseSection
            key={etape.id}
            etape={etape}
            rows={expenses.filter((e) => e.resolved_etape_id === etape.id && e.planned === (view === "planned"))}
            view={view}
            projectId={projectId}
            referenceCurrency={referenceCurrency}
            voyageId={voyageId}
          />
        ))}

        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Dépenses transverses</p>
              <p className="text-xs text-muted-foreground">Équipement, administratif & santé — pas propres à un pays.</p>
            </div>
            <ExpenseFormDialog
              scope={{ voyageId }}
              categories={TRANSVERSE_CATEGORIES}
              referenceCurrency={referenceCurrency}
              invalidateKey={["voyage-all-expenses", voyageId]}
              projectId={projectId}
              defaultPlanned={view === "planned"}
            />
          </div>
          <ExpenseList
            expenses={transverseRows}
            invalidateKey={["voyage-all-expenses", voyageId]}
            projectId={projectId}
            categories={TRANSVERSE_CATEGORIES}
            referenceCurrency={referenceCurrency}
          />
          <div className="flex justify-end text-sm font-semibold">{formatCurrency(sumAmount(transverseRows), referenceCurrency)}</div>
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

function EtapeExpenseSection({
  etape,
  rows,
  view,
  projectId,
  referenceCurrency,
  voyageId,
}: {
  etape: VoyageEtape;
  rows: VoyageAllExpense[];
  view: "planned" | "actual";
  projectId: string;
  referenceCurrency: string;
  voyageId: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
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
          defaultPlanned={view === "planned"}
        />
      </div>
      <ExpenseList
        expenses={rows}
        invalidateKey={["voyage-all-expenses", voyageId]}
        projectId={projectId}
        categories={ETAPE_CATEGORIES}
        referenceCurrency={referenceCurrency}
      />
      <div className="flex justify-end text-sm font-semibold">{formatCurrency(sumAmount(rows), referenceCurrency)}</div>
    </div>
  );
}
