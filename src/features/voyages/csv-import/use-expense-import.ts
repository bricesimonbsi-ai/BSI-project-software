import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import { invalidateAllExpenseQueries } from "@/features/voyages/use-expenses";
import type { ExpenseCategory } from "@/types/database";

export type ImportExpenseInput = {
  sous_etape_id: string | null;
  category: ExpenseCategory;
  sub_category?: string | null;
  amount: number;
  expense_date: string | null;
  description?: string | null;
  source: "carte" | "retrait";
};

/** Insertion en masse des dépenses issues d'un import CSV : toutes réelles (planned=false),
 * marquées `source` et `needs_review=true` (voir expense-import-dialog.tsx) — jamais de fichier
 * ni de contenu brut du relevé envoyé ici, uniquement les montants/dates/catégories déjà
 * résolus côté client. */
export function useImportExpenses(voyageId: string, referenceCurrency: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (inputs: ImportExpenseInput[]) => {
      if (!session) throw new Error("Non authentifié");
      if (inputs.length === 0) return;
      const rows = inputs.map((input) => ({
        voyage_id: input.sous_etape_id ? null : voyageId,
        sous_etape_id: input.sous_etape_id,
        etape_id: null,
        category: input.category,
        sub_category: input.sub_category ?? null,
        planned: false,
        amount: input.amount,
        currency: referenceCurrency,
        manual_rate_to_reference: 1,
        is_estimated: false,
        source: input.source,
        needs_review: true,
        description: input.description ?? null,
        expense_date: input.expense_date,
        created_by: session.user.id,
      }));
      const { error } = await supabase.from("voyage_expenses").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => invalidateAllExpenseQueries(queryClient),
    onError: (err) => toast({ title: "Erreur lors de l'import", description: (err as Error).message, variant: "destructive" }),
  });
}
