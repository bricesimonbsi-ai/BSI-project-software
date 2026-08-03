import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useCreateExpense } from "@/features/voyages/use-expenses";
import type { ExpenseCategory } from "@/types/database";
import { Plus } from "lucide-react";

export function ExpenseFormDialog({
  scope,
  categories,
  referenceCurrency,
  invalidateKey,
}: {
  scope: { voyageId?: string; sousEtapeId?: string };
  categories: { value: ExpenseCategory; label: string }[];
  referenceCurrency: string;
  invalidateKey: unknown[];
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>(categories[0].value);
  const [planned, setPlanned] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(referenceCurrency);
  const [rate, setRate] = useState("1");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createExpense = useCreateExpense(scope, invalidateKey);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createExpense.mutateAsync({
        category,
        planned,
        amount: Number(amount),
        currency,
        manual_rate_to_reference: currency === referenceCurrency ? 1 : Number(rate),
        description: description || undefined,
        expense_date: expenseDate || undefined,
      });
      setOpen(false);
      setAmount("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Dépense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle dépense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Montant</Label>
              <Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          {currency !== referenceCurrency && (
            <div className="space-y-2">
              <Label>Taux de conversion vers {referenceCurrency} (saisi manuellement)</Label>
              <Input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={planned ? "planned" : "actual"} onValueChange={(v) => setPlanned(v === "planned")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Prévisionnel</SelectItem>
                  <SelectItem value="actual">Réel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
