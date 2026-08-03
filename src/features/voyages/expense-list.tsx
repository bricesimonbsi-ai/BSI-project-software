import { useDeleteExpense } from "@/features/voyages/use-expenses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";
import { Trash2 } from "lucide-react";

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

export function ExpenseList({ expenses, invalidateKey }: { expenses: VoyageExpense[]; invalidateKey: unknown[] }) {
  const deleteExpense = useDeleteExpense(invalidateKey);

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
            </p>
            <p className="text-xs text-muted-foreground">{expense.expense_date ? formatDate(expense.expense_date) : "Sans date"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={expense.planned ? "outline" : "secondary"}>{expense.planned ? "Prévisionnel" : "Réel"}</Badge>
            <span className="text-sm font-semibold">{formatCurrency(expense.amount, expense.currency)}</span>
            <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(expense.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
