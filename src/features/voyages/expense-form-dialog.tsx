import { useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CurrencySelect } from "@/features/voyages/currency-select";
import { useCreateExpense, useUpdateExpense } from "@/features/voyages/use-expenses";
import { useProjectPeople } from "@/features/people/use-people";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";
import { Plus } from "lucide-react";

export function ExpenseFormDialog({
  scope = {},
  categories,
  referenceCurrency,
  invalidateKey,
  projectId,
  existing,
  trigger,
  defaultPlanned = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  /** Requis à la création (cible la dépense) ; ignoré en modification. */
  scope?: { voyageId?: string; sousEtapeId?: string };
  categories: { value: ExpenseCategory; label: string }[];
  referenceCurrency: string;
  invalidateKey: unknown[];
  /** Projet auquel rattacher la liste des personnes (nécessaire même pour une dépense
   * scope="sousEtapeId", puisque les personnes sont associées au niveau du projet). */
  projectId?: string;
  /** Dépense à modifier ; absent = création. */
  existing?: VoyageExpense;
  /** `null` = ne rend aucun DialogTrigger (dialogue entièrement piloté par `open`/`onOpenChange`). */
  trigger?: ReactNode | null;
  /** Statut par défaut à la création (réel pour une dépense saisie sur place, prévisionnel sinon). */
  defaultPlanned?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? categories[0].value);
  const [planned, setPlanned] = useState(existing?.planned ?? defaultPlanned);
  const [amount, setAmount] = useState(existing?.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? referenceCurrency);
  const [rate, setRate] = useState(existing?.manual_rate_to_reference?.toString() ?? "1");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [expenseDate, setExpenseDate] = useState(existing?.expense_date ?? "");
  const [personId, setPersonId] = useState<string>(existing?.person_id ?? "none");
  const [submitting, setSubmitting] = useState(false);
  const createExpense = useCreateExpense(scope, invalidateKey);
  const updateExpense = useUpdateExpense(invalidateKey);
  const { data: linkedPeople } = useProjectPeople(projectId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        category,
        planned,
        amount: Number(amount),
        currency,
        manual_rate_to_reference: currency === referenceCurrency ? 1 : Number(rate),
        description: description || undefined,
        expense_date: expenseDate || undefined,
        person_id: personId === "none" ? null : personId,
      };
      if (existing) {
        await updateExpense.mutateAsync({ id: existing.id, ...payload });
      } else {
        await createExpense.mutateAsync(payload);
        setAmount("");
        setDescription("");
        setPersonId("none");
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Dépense
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
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
              <CurrencySelect value={currency} onChange={setCurrency} />
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
                  <SelectItem value="actual">Réel</SelectItem>
                  <SelectItem value="planned">Prévisionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {linkedPeople && linkedPeople.length > 0 && (
            <div className="space-y-2">
              <Label>Rattacher à une personne (optionnel)</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Dépense commune</SelectItem>
                  {linkedPeople.map((l) => (
                    <SelectItem key={l.person_id} value={l.person_id}>
                      {l.people.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : existing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
