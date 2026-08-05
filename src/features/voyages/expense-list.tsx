import { useState } from "react";
import { useDeleteExpense, CATEGORY_LABELS, TRANSPORT_SUB_CATEGORIES, ADMIN_SANTE_SUB_CATEGORIES } from "@/features/voyages/use-expenses";
import { useProjectPeople } from "@/features/people/use-people";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseFormFields } from "@/features/voyages/expense-form-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";
import { Pencil, Trash2 } from "lucide-react";

const subCategoryLabels: Record<string, string> = Object.fromEntries(
  [...TRANSPORT_SUB_CATEGORIES, ...ADMIN_SANTE_SUB_CATEGORIES].map((s) => [s.value, s.label])
);

export function ExpenseList({
  expenses,
  invalidateKey,
  projectId,
  categories,
  referenceCurrency,
  /** Édition inline (pas de Dialog) — obligatoire quand la liste vit déjà dans un Dialog
   * (ex. dialogue d'une ville), pour éviter un Dialog imbriqué dans un Dialog. */
  inline = false,
  /** Si vrai, masque le sélecteur Statut à l'édition (liste dont toutes les lignes sont réelles). */
  lockPlanned = false,
}: {
  expenses: (VoyageExpense & { city_name?: string | null })[];
  invalidateKey: unknown[];
  projectId?: string;
  /** Requis pour permettre la modification (mêmes catégories que le formulaire d'ajout). */
  categories?: { value: ExpenseCategory; label: string }[];
  referenceCurrency?: string;
  inline?: boolean;
  lockPlanned?: boolean;
}) {
  const deleteExpense = useDeleteExpense(invalidateKey);
  const { data: linkedPeople } = useProjectPeople(projectId);
  const personName = (id: string | null) => (id ? linkedPeople?.find((l) => l.person_id === id)?.people.name : undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogEditing, setDialogEditing] = useState<VoyageExpense | null>(null);

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune dépense pour l'instant.</p>;
  }

  const canEdit = !!categories && !!referenceCurrency;

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {expenses.map((expense) => {
        if (inline && editingId === expense.id && categories && referenceCurrency) {
          return (
            <li key={expense.id} className="border-l-2 border-l-accent p-3">
              <ExpenseFormFields
                existing={expense}
                categories={categories}
                referenceCurrency={referenceCurrency}
                invalidateKey={invalidateKey}
                projectId={projectId}
                lockPlanned={lockPlanned}
                onDone={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            </li>
          );
        }
        return (
          <li key={expense.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-medium">
                {CATEGORY_LABELS[expense.category] ?? expense.category}
                {expense.sub_category ? ` (${subCategoryLabels[expense.sub_category] ?? expense.sub_category})` : ""}
                {expense.city_name ? ` · ${expense.city_name}` : ""}
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
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => (inline ? setEditingId(expense.id) : setDialogEditing(expense))}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={() => deleteExpense.mutate(expense.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        );
      })}
      {!inline && dialogEditing && categories && referenceCurrency && (
        <ExpenseFormDialog
          existing={dialogEditing}
          categories={categories}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          projectId={projectId}
          trigger={null}
          lockPlanned={lockPlanned}
          open={dialogEditing !== null}
          onOpenChange={(o) => !o && setDialogEditing(null)}
        />
      )}
    </ul>
  );
}
