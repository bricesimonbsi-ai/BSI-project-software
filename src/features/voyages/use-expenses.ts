import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import type {
  ExpenseCategory,
  VoyageExpense,
  VoyageAllExpense,
  VoyageBudgetSummary,
  VoyageEtapeBudgetSummary,
  VoyageCategoryBudgetSummary,
  VoyagePersonExpenseSummary,
} from "@/types/database";

export const PRE_DEPARTURE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "equipement", label: "Équipement" },
  { value: "transport_international", label: "Transport international" },
  { value: "assurance", label: "Assurance" },
  { value: "visas", label: "Visas" },
  { value: "vaccins", label: "Vaccins" },
  { value: "administratif", label: "Administratif" },
  { value: "vehicule", label: "Véhicule" },
  { value: "financement", label: "Financement (épargne)" },
  { value: "imprevus", label: "Imprévus (fonds d'urgence)" },
  { value: "frais_bancaires", label: "Frais bancaires" },
];

export const ON_SITE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "logement", label: "Logement" },
  { value: "nourriture", label: "Nourriture" },
  { value: "activites", label: "Activités" },
  { value: "transport_local", label: "Transport local" },
  { value: "imprevus", label: "Imprévus" },
];

export function useVoyageExpenses(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-expenses", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageExpense[]> => {
      const { data, error } = await supabase
        .from("voyage_expenses")
        .select("*")
        .eq("voyage_id", voyageId as string)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSousEtapeExpenses(sousEtapeId: string | undefined) {
  return useQuery({
    queryKey: ["sous-etape-expenses", sousEtapeId],
    enabled: !!sousEtapeId,
    queryFn: async (): Promise<VoyageExpense[]> => {
      const { data, error } = await supabase
        .from("voyage_expenses")
        .select("*")
        .eq("sous_etape_id", sousEtapeId as string)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEtapeExpenses(etapeId: string | undefined) {
  return useQuery({
    queryKey: ["etape-expenses", etapeId],
    enabled: !!etapeId,
    queryFn: async (): Promise<VoyageExpense[]> => {
      const { data, error } = await supabase
        .from("voyage_expenses")
        .select("*")
        .eq("etape_id", etapeId as string)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Source unique pour toute agrégation de budget côté client (vue d'ensemble par ville/pays,
 * transverses, totaux) : une ligne par dépense, quel que soit son niveau de rattachement. */
export function useVoyageAllExpenses(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-all-expenses", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageAllExpense[]> => {
      const { data, error } = await supabase
        .from("voyage_all_expenses")
        .select("*")
        .eq("resolved_voyage_id", voyageId as string)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type ExpenseInput = {
  category: ExpenseCategory;
  planned: boolean;
  amount: number;
  currency: string;
  manual_rate_to_reference: number;
  description?: string;
  expense_date?: string;
  person_id?: string | null;
};

function invalidateBudgetQueries(queryClient: ReturnType<typeof useQueryClient>, invalidateKey: unknown[]) {
  queryClient.invalidateQueries({ queryKey: invalidateKey });
  queryClient.invalidateQueries({ queryKey: ["voyage-budget-summary"] });
  queryClient.invalidateQueries({ queryKey: ["etape-budget-summary"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-category-budget-summary"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-person-expense-summary"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-all-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["etape-expenses"] });
}

export function useCreateExpense(
  scope: { voyageId?: string; sousEtapeId?: string; etapeId?: string },
  invalidateKey: unknown[]
) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!session) throw new Error("Non authentifié");
      const { error } = await supabase.from("voyage_expenses").insert({
        voyage_id: scope.voyageId ?? null,
        sous_etape_id: scope.sousEtapeId ?? null,
        etape_id: scope.etapeId ?? null,
        ...input,
        created_by: session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateBudgetQueries(queryClient, invalidateKey),
  });
}

export function useUpdateExpense(invalidateKey: unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExpenseInput> & { id: string }) => {
      const { error } = await supabase.from("voyage_expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBudgetQueries(queryClient, invalidateKey),
  });
}

export function useDeleteExpense(invalidateKey: unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voyage_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBudgetQueries(queryClient, invalidateKey),
  });
}

export function useVoyageBudgetSummary(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-budget-summary", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageBudgetSummary | null> => {
      const { data, error } = await supabase
        .from("voyage_budget_summary")
        .select("*")
        .eq("voyage_id", voyageId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useEtapeBudgetSummaries(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["etape-budget-summary", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageEtapeBudgetSummary[]> => {
      const { data, error } = await supabase
        .from("voyage_etape_budget_summary")
        .select("*")
        .eq("voyage_id", voyageId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Totaux (prévisionnel/réel) par grande catégorie de dépense, avant-départ et sur place confondues. */
export function useVoyageCategoryBudgetSummary(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-category-budget-summary", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyageCategoryBudgetSummary[]> => {
      const { data, error } = await supabase
        .from("voyage_category_budget_summary")
        .select("*")
        .eq("voyage_id", voyageId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Dépenses réelles/prévisionnelles rattachées à chaque personne associée au projet du voyage. */
export function useVoyagePersonExpenseSummary(voyageId: string | undefined) {
  return useQuery({
    queryKey: ["voyage-person-expense-summary", voyageId],
    enabled: !!voyageId,
    queryFn: async (): Promise<VoyagePersonExpenseSummary[]> => {
      const { data, error } = await supabase
        .from("voyage_person_expense_summary")
        .select("*")
        .eq("voyage_id", voyageId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}
