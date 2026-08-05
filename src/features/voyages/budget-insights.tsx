import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectPeople } from "@/features/people/use-people";
import {
  useVoyageAllExpenses,
  useVoyagePersonExpenseSummary,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  TRANSPORT_SUB_CATEGORIES,
  ADMIN_SANTE_SUB_CATEGORIES,
  groupedCategory,
  groupedSubCategory,
} from "@/features/voyages/use-expenses";
import { CategoryComparisonChart, type CategoryComparisonRow } from "@/features/voyages/category-comparison-chart";
import { BudgetOverviewTable } from "@/features/voyages/budget-overview-table";
import { formatCurrency } from "@/lib/utils";
import type { Voyage } from "@/types/database";

const SUB_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...TRANSPORT_SUB_CATEGORIES, ...ADMIN_SANTE_SUB_CATEGORIES].map((s) => [s.value, s.label])
);

function toRows(map: Map<string, { planned: number; actual: number }>, labels: Record<string, string>): CategoryComparisonRow[] {
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, label: labels[key] ?? key, ...v }))
    .filter((r) => r.planned > 0 || r.actual > 0);
}

/**
 * Budget du voyage : deux chiffres clés (total du voyage / par personne, prévisionnel et
 * réel côte à côte pour ne jamais les confondre), un graphique de comparaison prévisionnel vs
 * réel par catégorie (les 6 catégories unifiées de l'application), le détail par sous-type pour
 * transport et administratif & santé, et le détail éditable en dessous — tout calculé à partir
 * de la même source (`voyage_all_expenses`), donc chiffres et tableau coïncident toujours.
 */
export function BudgetInsights({ voyage, projectId }: { voyage: Voyage; projectId: string }) {
  const voyageId = voyage.id;
  const { data: linkedPeople } = useProjectPeople(projectId);
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);
  const { data: personSummary } = useVoyagePersonExpenseSummary(voyageId);

  const travelerCount = linkedPeople?.length || voyage.adults_count + voyage.children_count || 1;
  const expenses = allExpenses ?? [];

  const totalPlanned = expenses.filter((e) => e.planned).reduce((s, e) => s + e.amount * e.manual_rate_to_reference, 0);
  const totalActual = expenses.filter((e) => !e.planned).reduce((s, e) => s + e.amount * e.manual_rate_to_reference, 0);

  const { categoryRows, transportRows, adminSanteRows } = useMemo(() => {
    const byCategory = new Map<string, { planned: number; actual: number }>();
    const byTransportSub = new Map<string, { planned: number; actual: number }>();
    const byAdminSub = new Map<string, { planned: number; actual: number }>();
    for (const e of expenses) {
      const category = groupedCategory(e.category);
      const amount = e.amount * e.manual_rate_to_reference;
      const bucket = byCategory.get(category) ?? { planned: 0, actual: 0 };
      if (e.planned) bucket.planned += amount;
      else bucket.actual += amount;
      byCategory.set(category, bucket);

      if (category === "transport" || category === "administratif_sante") {
        const sub = groupedSubCategory(e);
        const target = category === "transport" ? byTransportSub : byAdminSub;
        const subBucket = target.get(sub) ?? { planned: 0, actual: 0 };
        if (e.planned) subBucket.planned += amount;
        else subBucket.actual += amount;
        target.set(sub, subBucket);
      }
    }
    return {
      categoryRows: toRows(byCategory, CATEGORY_LABELS),
      transportRows: toRows(byTransportSub, SUB_CATEGORY_LABELS),
      adminSanteRows: toRows(byAdminSub, SUB_CATEGORY_LABELS),
    };
  }, [expenses]);

  // Toutes les catégories unifiées apparaissent dans le graphique principal, même à 0, pour que
  // sa forme (6 catégories fixes) reste stable d'un voyage à l'autre.
  const mainRows: CategoryComparisonRow[] = EXPENSE_CATEGORIES.map(
    (c) => categoryRows.find((r) => r.key === c.value) ?? { key: c.value, label: c.label, planned: 0, actual: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total du voyage</p>
            <p className="text-lg font-bold">
              {formatCurrency(totalPlanned, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">prévu</span>
            </p>
            <p className="text-lg font-bold">
              {formatCurrency(totalActual, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">réel</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Par personne ({travelerCount})</p>
            <p className="text-lg font-bold">
              {formatCurrency(totalPlanned / travelerCount, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                prévu{voyage.budget_target_per_person ? ` / cible ${formatCurrency(voyage.budget_target_per_person, voyage.reference_currency)}` : ""}
              </span>
            </p>
            <p className="text-lg font-bold">
              {formatCurrency(totalActual / travelerCount, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">réel</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévisionnel / réel par catégorie</h3>
        <CategoryComparisonChart rows={mainRows} currency={voyage.reference_currency} />
      </div>

      {(transportRows.length > 0 || adminSanteRows.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2">
          {transportRows.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Détail transport</h3>
              <CategoryComparisonChart rows={transportRows} currency={voyage.reference_currency} hue="sky" />
            </div>
          )}
          {adminSanteRows.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Détail administratif & santé</h3>
              <CategoryComparisonChart rows={adminSanteRows} currency={voyage.reference_currency} hue="rose" />
            </div>
          )}
        </div>
      )}

      <BudgetOverviewTable voyageId={voyageId} projectId={projectId} referenceCurrency={voyage.reference_currency} />

      {personSummary && personSummary.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dépenses par personne</h3>
          <div className="space-y-1">
            {personSummary.map((p) => (
              <div key={p.person_id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="font-semibold">
                  {formatCurrency(p.total_planned ?? 0, voyage.reference_currency)} prévu ·{" "}
                  {formatCurrency(p.total_actual ?? 0, voyage.reference_currency)} réel
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
