import { useVoyageAllExpenses, useUpdateExpense, useDeleteExpense, useAssignExpenseToCity, ETAPE_CATEGORIES, CATEGORY_LABELS } from "@/features/voyages/use-expenses";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { buildFlatRows } from "@/features/voyages/itinerary/itinerary-model";
import { ExpenseImportDialog } from "@/features/voyages/csv-import/expense-import-dialog";
import { ExpenseSourceBadge } from "@/features/voyages/expense-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Trash2, Check } from "lucide-react";
import type { ExpenseCategory, VoyageAllExpense, VoyageSousEtape } from "@/types/database";

const NONE = "__none__";

const MANAGE_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  ...ETAPE_CATEGORIES,
  { value: "non_categorise", label: CATEGORY_LABELS.non_categorise },
];

/**
 * Point d'entrée unique pour traiter les dépenses importées en attente : centralise TOUTES les
 * dépenses `needs_review`, qu'elles aient déjà une ville/catégorie (juste à confirmer) ou aucune
 * des deux (à finir de renseigner) — sans avoir à les chercher ville par ville dans l'onglet
 * Synthèse. Import CSV directement ici aussi, pour que tout le cycle (import → tri → validation)
 * tienne dans un seul endroit.
 */
export function ManageExpensesTab({
  voyageId,
  projectId,
  referenceCurrency,
}: {
  voyageId: string;
  projectId: string;
  referenceCurrency: string;
}) {
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);

  const citiesByEtape = new Map<string, VoyageSousEtape[]>();
  for (const se of allSousEtapes ?? []) {
    const list = citiesByEtape.get(se.etape_id) ?? [];
    list.push(se);
    citiesByEtape.set(se.etape_id, list);
  }
  const flat = buildFlatRows(etapes ?? [], citiesByEtape);
  const cityOptions = flat.map((r) => ({ id: r.sousEtape.id, label: `${r.etape.country_region} · ${r.sousEtape.city}` }));

  const pending = (allExpenses ?? []).filter((e) => e.needs_review);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gérer mes dépenses</h3>
          <p className="text-xs text-muted-foreground">Importe ton relevé bancaire, puis affecte ville/catégorie et valide chaque dépense.</p>
        </div>
        <ExpenseImportDialog voyageId={voyageId} projectId={projectId} referenceCurrency={referenceCurrency} />
      </div>

      {pending.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucune dépense à valider pour l'instant.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {pending.map((e) => (
            <PendingExpenseRow key={e.id} expense={e} cityOptions={cityOptions} referenceCurrency={referenceCurrency} voyageId={voyageId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingExpenseRow({
  expense,
  cityOptions,
  referenceCurrency,
  voyageId,
}: {
  expense: VoyageAllExpense;
  cityOptions: { id: string; label: string }[];
  referenceCurrency: string;
  voyageId: string;
}) {
  const invalidateKey = ["voyage-all-expenses", voyageId];
  const updateExpense = useUpdateExpense(invalidateKey);
  const deleteExpense = useDeleteExpense(invalidateKey);
  const assignToCity = useAssignExpenseToCity(invalidateKey);
  // Sans ville ni catégorie, la dépense reste invisible dans le tableau détail (voir
  // budget-overview-table.tsx) : la valider trop tôt la ferait "disparaître" sans qu'on puisse
  // encore la retrouver ailleurs que dans cet onglet — on bloque donc tant que les deux ne sont
  // pas renseignés.
  const canValidate = expense.sous_etape_id != null && expense.category !== "non_categorise";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          <ExpenseSourceBadge source={expense.source} /> {expense.description || "(sans libellé)"}
        </p>
        <p className="text-xs text-muted-foreground">{expense.expense_date ? formatDate(expense.expense_date) : "Sans date"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{formatCurrency(expense.amount * expense.manual_rate_to_reference, referenceCurrency)}</span>
        <Select value={expense.category} onValueChange={(v) => updateExpense.mutate({ id: expense.id, category: v as ExpenseCategory })}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MANAGE_CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={expense.sous_etape_id ?? NONE} onValueChange={(v) => v !== NONE && assignToCity.mutate({ id: expense.id, sousEtapeId: v })}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Non affectée" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Non affectée</SelectItem>
            {cityOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-emerald-700 disabled:text-muted-foreground dark:text-emerald-300"
          disabled={!canValidate}
          title={canValidate ? undefined : "Affecte d'abord une ville et une catégorie pour pouvoir valider"}
          onClick={() => updateExpense.mutate({ id: expense.id, needs_review: false })}
        >
          <Check className="h-3.5 w-3.5" />
          Valider
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => deleteExpense.mutate(expense.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
