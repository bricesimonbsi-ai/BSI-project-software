import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CurrencySelect } from "@/features/voyages/currency-select";
import {
  useCreateExpense,
  useUpdateExpense,
  TRANSPORT_SUB_CATEGORIES,
  ADMIN_SANTE_SUB_CATEGORIES,
} from "@/features/voyages/use-expenses";
import { useProjectPeople } from "@/features/people/use-people";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";

function subCategoryOptions(category: ExpenseCategory): { value: string; label: string }[] | null {
  if (category === "transport") return TRANSPORT_SUB_CATEGORIES;
  if (category === "administratif_sante") return ADMIN_SANTE_SUB_CATEGORIES;
  return null;
}

/**
 * Champs du formulaire de dépense, réutilisés à la fois dans un Dialog (contexte non
 * imbriqué, ex. onglet Budget) et inline (contexte imbriqué dans un autre Dialog, ex.
 * dialogue d'une ville — un Dialog dans un Dialog ferme parfois le parent de façon
 * intempestive, donc pas de Dialog imbriqué : le formulaire s'affiche directement).
 */
export function ExpenseFormFields({
  scope = {},
  categories,
  referenceCurrency,
  invalidateKey,
  projectId,
  existing,
  defaultPlanned = true,
  lockPlanned = false,
  onDone,
  onCancel,
}: {
  scope?: { voyageId?: string; sousEtapeId?: string; etapeId?: string };
  categories: { value: ExpenseCategory; label: string }[];
  referenceCurrency: string;
  invalidateKey: unknown[];
  projectId?: string;
  existing?: VoyageExpense;
  defaultPlanned?: boolean;
  /** Si vrai, masque le sélecteur Statut et fige le statut sur `defaultPlanned` (ex. un
   * formulaire de saisie de dépenses réelles n'a pas besoin de proposer "Prévisionnel"). */
  lockPlanned?: boolean;
  /** Appelé après un enregistrement réussi. */
  onDone: () => void;
  /** Si fourni, affiche un bouton Annuler. */
  onCancel?: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? categories[0].value);
  const [subCategory, setSubCategory] = useState(existing?.sub_category ?? "");
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

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const payload = {
        category,
        sub_category: subCategory || null,
        planned,
        amount: Number(amount),
        currency,
        manual_rate_to_reference: currency === referenceCurrency ? 1 : Number(rate),
        description: description || undefined,
        expense_date: expenseDate || undefined,
        person_id: personId === "none" ? null : personId,
        is_estimated: false,
      };
      if (existing) {
        await updateExpense.mutateAsync({ id: existing.id, ...payload });
      } else {
        await createExpense.mutateAsync(payload);
        setAmount("");
        setDescription("");
        setPersonId("none");
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = amount.trim() !== "" && !submitting;

  return (
    // Attention : ce composant s'affiche aussi en ligne dans SousEtapeDialog, qui a lui-même
    // un <form> englobant — un <form> imbriqué est invalide en HTML et faisait remonter la
    // soumission au formulaire parent (fermant le dialogue de la ville). Un <div> + bouton
    // "button" évite ce piège, y compris dans le contexte non imbriqué (onglet Budget).
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as ExpenseCategory);
            setSubCategory("");
          }}
        >
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
      {subCategoryOptions(category) && (
        <div className="space-y-2">
          <Label>Détail</Label>
          <Select value={subCategory} onValueChange={setSubCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {subCategoryOptions(category)!.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Montant</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
      <div className={cn("grid gap-4", lockPlanned ? "grid-cols-1" : "grid-cols-2")}>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </div>
        {!lockPlanned && (
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
        )}
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && (e.preventDefault(), handleSubmit())}
        />
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
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Enregistrement..." : existing ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </div>
  );
}
