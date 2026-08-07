import { useUpdateExpense } from "@/features/voyages/use-expenses";
import { cn } from "@/lib/utils";
import type { VoyageExpense } from "@/types/database";

/** Pastille d'origine (💳 carte / 💵 part d'un retrait ventilée) — n'apparaît que sur les
 * dépenses importées depuis un relevé bancaire (voir expense-import-dialog.tsx) ; une dépense
 * saisie à la main n'a pas de `source` et n'affiche donc jamais rien ici. */
export function ExpenseSourceBadge({ source }: { source: "carte" | "retrait" | null }) {
  if (!source) return null;
  return <span title={source === "carte" ? "Importée depuis le relevé bancaire" : "Part d'un retrait d'espèces ventilée"}>{source === "carte" ? "💳" : "💵"}</span>;
}

/** Pastille "à valider" + action de validation en un clic (`needs_review` -> faux) : une dépense
 * importée reste marquée tant qu'elle n'a pas été relue manuellement (catégorie/ville/montant
 * vérifiés), sans bloquer son utilisation dans les totaux entre-temps. */
export function NeedsReviewBadge({ expense, invalidateKey, className }: { expense: VoyageExpense; invalidateKey: unknown[]; className?: string }) {
  const updateExpense = useUpdateExpense(invalidateKey);
  if (!expense.needs_review) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        updateExpense.mutate({ id: expense.id, needs_review: false });
      }}
      title="Cliquer pour valider cette dépense importée"
      className={cn(
        "rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-300",
        className
      )}
    >
      à valider
    </button>
  );
}
