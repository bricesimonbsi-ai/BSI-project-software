import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectPeople } from "@/features/people/use-people";
import {
  useVoyageAllExpenses,
  useVoyageExpenses,
  useVoyagePersonExpenseSummary,
  PRE_DEPARTURE_CATEGORIES,
  ON_SITE_CATEGORIES,
} from "@/features/voyages/use-expenses";
import { BudgetRing } from "@/features/voyages/budget-ring";
import { BudgetOverviewTable } from "@/features/voyages/budget-overview-table";
import { formatCurrency } from "@/lib/utils";
import type { TravelStyle, Voyage } from "@/types/database";

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...PRE_DEPARTURE_CATEGORIES, ...ON_SITE_CATEGORIES].map((c) => [c.value, c.label])
);

function sumAmount(rows: { amount: number; manual_rate_to_reference: number; planned: boolean }[], planned: boolean): number {
  return rows.filter((e) => e.planned === planned).reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
}

/**
 * Indicateurs budget (total, par personne, par catégorie) + comparatif prévisionnel / réel en
 * anneaux, calculés directement à partir de `voyage_all_expenses` — une seule source de vérité
 * pour tous les totaux affichés dans l'onglet Budget (plus de calcul d'estimation parallèle).
 */
export function BudgetInsights({ voyage, projectId }: { voyage: Voyage; projectId: string }) {
  const voyageId = voyage.id;
  const { data: linkedPeople } = useProjectPeople(projectId);
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);
  const { data: transverseExpenses } = useVoyageExpenses(voyageId);
  const { data: personSummary } = useVoyagePersonExpenseSummary(voyageId);

  const travelerCount = linkedPeople?.length || voyage.adults_count + voyage.children_count || 1;
  const style: TravelStyle = voyage.travel_style ?? "standard";

  const expenses = allExpenses ?? [];
  const totalPlanned = sumAmount(expenses, true);
  const totalActual = sumAmount(expenses, false);
  const perPersonPlanned = totalPlanned / travelerCount;

  const categoryRows = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number }>();
    for (const e of expenses) {
      const entry = map.get(e.category) ?? { planned: 0, actual: 0 };
      const amount = e.amount * e.manual_rate_to_reference;
      if (e.planned) entry.planned += amount;
      else entry.actual += amount;
      map.set(e.category, entry);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category] ?? category, ...v }))
      .filter((c) => c.planned > 0 || c.actual > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allExpenses]);

  const transverseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of transverseExpenses ?? []) {
      if (!e.planned) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount * e.manual_rate_to_reference);
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, label: CATEGORY_LABELS[category] ?? category, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [transverseExpenses]);
  const maxTransverse = Math.max(1, ...transverseByCategory.map((c) => c.amount));

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
            <p className="text-lg font-bold">{formatCurrency(totalActual, voyage.reference_currency)}</p>
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
      <p className="text-xs text-muted-foreground">
        Le budget prévisionnel additionne les estimations par ville (logement, nourriture, transport, activités — voir
        l'onglet Itinéraire), les visas par pays et les dépenses transverses ci-dessous ; chaque estimation reste
        ajustable, et l'ajustement se répercute immédiatement ici. Style de voyage réglable dans l'onglet Aperçu.
      </p>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comparatif prévisionnel / réel, par catégorie (tout le voyage)
        </h3>
        <div className="flex flex-wrap gap-4">
          <BudgetRing label="Ensemble du voyage" planned={totalPlanned} actual={totalActual} currency={voyage.reference_currency} size={112} />
          {categoryRows.map((c) => (
            <BudgetRing key={c.category} label={c.label} planned={c.planned} actual={c.actual} currency={voyage.reference_currency} />
          ))}
        </div>
      </div>

      {transverseByCategory.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Répartition des dépenses transverses prévisionnelles (équipement, assurance, vaccins, administratif...)
          </h3>
          <div className="space-y-2">
            {transverseByCategory.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">{c.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(c.amount / maxTransverse) * 100}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-semibold">
                  {formatCurrency(c.amount, voyage.reference_currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <BudgetOverviewTable
        voyageId={voyageId}
        projectId={projectId}
        referenceCurrency={voyage.reference_currency}
        travelStyle={style}
        travelerCount={travelerCount}
        lodgingCount={voyage.lodging_count ?? travelerCount}
      />

      {personSummary && personSummary.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dépenses rattachées à une personne
          </h3>
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
