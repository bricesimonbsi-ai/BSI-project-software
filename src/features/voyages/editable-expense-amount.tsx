import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useCreateExpense, useUpdateExpense } from "@/features/voyages/use-expenses";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";

/**
 * Case éditable liée à UNE dépense réelle (`voyage_expenses`), pas à un calcul parallèle :
 * si `existing` est fourni, la saisie met à jour cette ligne directement ; sinon, dès qu'une
 * estimation auto est disponible (`estimate`) elle est persistée immédiatement pour alimenter
 * les totaux sans action de l'utilisateur, et devient ensuite une ligne normale qu'il peut
 * ajuster. Garantit qu'il n'existe jamais qu'une seule source de vérité pour un montant donné.
 */
export function EditableExpenseAmount({
  scope,
  category,
  planned,
  existing,
  estimate = null,
  referenceCurrency,
  invalidateKey,
  className,
}: {
  scope: { voyageId?: string; sousEtapeId?: string; etapeId?: string };
  category: ExpenseCategory;
  planned: boolean;
  existing: VoyageExpense | undefined;
  /** Montant auto-estimé à pré-persister si aucune dépense n'existe encore ; null = pas d'estimation (saisie manuelle seule). */
  estimate?: number | null;
  referenceCurrency: string;
  invalidateKey: unknown[];
  className?: string;
}) {
  const createExpense = useCreateExpense(scope, invalidateKey);
  const updateExpense = useUpdateExpense(invalidateKey);
  const createdRef = useRef(false);
  const [value, setValue] = useState(existing?.amount?.toString() ?? "");

  useEffect(() => {
    setValue(existing?.amount?.toString() ?? "");
  }, [existing?.amount]);

  useEffect(() => {
    if (existing || createdRef.current) return;
    if (estimate == null || estimate <= 0) return;
    createdRef.current = true;
    createExpense.mutate({
      category,
      planned,
      amount: Math.round(estimate * 100) / 100,
      currency: referenceCurrency,
      manual_rate_to_reference: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, estimate]);

  function handleBlur() {
    const amount = value.trim() === "" ? 0 : Math.max(0, Number(value));
    if (existing) {
      if (amount !== existing.amount) updateExpense.mutate({ id: existing.id, amount });
    } else if (amount > 0 && !createdRef.current) {
      createdRef.current = true;
      createExpense.mutate({ category, planned, amount, currency: referenceCurrency, manual_rate_to_reference: 1 });
    }
  }

  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      value={value}
      placeholder={estimate != null && estimate > 0 ? Math.round(estimate).toString() : "0"}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
}
