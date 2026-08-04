import { useState } from "react";
import { useDeleteExpense } from "@/features/voyages/use-expenses";
import { useProjectPeople } from "@/features/people/use-people";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";
import { Pencil, Trash2 } from "lucide-react";

const categoryLabels: Record<ExpenseCategory, string> = {
  equipement: "Équipement",
  transport_international: "Transport international",
  assurance: "Assurance",
  visas: "Visas",
  vaccins: "Vaccins",
  administratif: "Administratif",
  vehicule: "Véhicule",
  financement: "Financement",
  imprevus: "Imprévus",
  frais_bancaires: "Frais bancaires",
  logement: "Logement",
  nourriture: "Nourriture",
  activites: "Activités",
  transport_local: "Transport local",
};

export function ExpenseList({
  expenses,
  invalidateKey,
  projectId,
  categories,
  referenceCurrency,
}: {
  expenses: VoyageExpense[];
  invalidateKey: unknown[];
  projectId?: string;
  /** Requis pour permettre la modification en ligne (mêmes catégories que le formulaire d'ajout). */
  categories?: { value: ExpenseCategory; label: string }[];
  referenceCurrency?: string;
}) {
  const deleteExpense = useDeleteExpense(invalidateKey);
  const { data: linkedPeople } = useProjectPeople(projectId);
  const personName = (id: string | null) => (id ? linkedPeople?.find((l) => l.person_id === id)?.people.name : undefined);
  const [editing, setEditing] = useState<VoyageExpense | null>(null);

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune dépense pour l'instant.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {expenses.map((expense) => (
        <li key={expense.id} className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-medium">
              {categoryLabels[expense.category]}
              {expense.description ? ` — ${expense.description}` : ""}
              {personName(expense.person_id) ? ` · ${personName(expense.person_id)}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{expense.expense_date ? formatDate(expense.expense_date) : "Sans date"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "border-transparent",
                expense.planned
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              )}
            >
              {expense.planned ? "Prévisionnel" : "Réel"}
            </Badge>
            <span className="text-sm font-semibold">{formatCurrency(expense.amount, expense.currency)}</span>
            {categories && referenceCurrency && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(expense)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(expense.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
      {editing && categories && referenceCurrency && (
        <ExpenseFormDialog
          existing={editing}
          categories={categories}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          projectId={projectId}
          trigger={null}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </ul>
  );
}
