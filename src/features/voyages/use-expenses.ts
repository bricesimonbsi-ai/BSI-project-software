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

export type CategoryScope = "transverse" | "etape";

/**
 * Catégories unifiées pour toute l'application : "transverse" (équipement, administratif &
 * santé) ne se rattache qu'au voyage entier, jamais à une étape ni une ville ; les autres
 * ("etape") peuvent se rattacher à une étape (pays) ou une ville. Les anciennes valeurs de
 * catégorie (transport_international, visas, vaccins...) restent des `ExpenseCategory` valides
 * pour ne pas invalider les dépenses déjà saisies (voir CATEGORY_LABELS), mais ne sont plus
 * proposées à la saisie.
 */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; scope: CategoryScope }[] = [
  { value: "transport", label: "Transport", scope: "etape" },
  { value: "logement", label: "Logement", scope: "etape" },
  { value: "nourriture", label: "Nourriture", scope: "etape" },
  { value: "activites", label: "Activités", scope: "etape" },
  { value: "equipement", label: "Équipement", scope: "transverse" },
  { value: "administratif_sante", label: "Administratif & santé", scope: "transverse" },
];

export const TRANSVERSE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c.scope === "transverse");
export const ETAPE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c.scope === "etape");

/** Sous-type libre (`sub_category`) proposé quand la catégorie est "transport". */
export const TRANSPORT_SUB_CATEGORIES: { value: string; label: string }[] = [
  { value: "avion", label: "Avion" },
  { value: "train", label: "Train" },
  { value: "bus", label: "Bus" },
  { value: "taxi", label: "Taxi" },
  { value: "voiture", label: "Voiture" },
  { value: "ferry_bateau", label: "Ferry / Bateau" },
  { value: "autre", label: "Autre" },
];

/** Sous-type libre (`sub_category`) proposé quand la catégorie est "administratif_sante". */
export const ADMIN_SANTE_SUB_CATEGORIES: { value: string; label: string }[] = [
  { value: "assurance", label: "Assurance" },
  { value: "visa", label: "Visa" },
  { value: "vaccin", label: "Vaccin" },
  { value: "frais_bancaires", label: "Frais bancaires" },
  { value: "imprevus", label: "Imprévus" },
  { value: "autre", label: "Autre" },
];

/** Libellés pour TOUTES les valeurs de catégorie possibles, y compris les anciennes valeurs
 * (encore présentes sur des dépenses saisies avant l'unification) — source unique d'affichage. */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transport: "Transport",
  logement: "Logement",
  nourriture: "Nourriture",
  activites: "Activités",
  equipement: "Équipement",
  administratif_sante: "Administratif & santé",
  transport_international: "Transport international",
  transport_local: "Transport local",
  assurance: "Assurance",
  visas: "Visas",
  vaccins: "Vaccins",
  administratif: "Administratif",
  vehicule: "Véhicule",
  financement: "Financement",
  imprevus: "Imprévus",
  frais_bancaires: "Frais bancaires",
};

/** @deprecated Remplacé par TRANSVERSE_CATEGORIES + ETAPE_CATEGORIES (catégories unifiées). */
export const PRE_DEPARTURE_CATEGORIES = TRANSVERSE_CATEGORIES;
/** @deprecated Remplacé par TRANSVERSE_CATEGORIES + ETAPE_CATEGORIES (catégories unifiées). */
export const ON_SITE_CATEGORIES = ETAPE_CATEGORIES;

/** Regroupe une ancienne valeur de catégorie (saisie avant l'unification) dans l'une des 6
 * catégories unifiées, pour que les dépenses historiques s'affichent correctement dans les
 * graphiques et le détail par catégorie plutôt que de disparaître ou de créer un groupe à part. */
const LEGACY_CATEGORY_GROUP: Record<string, ExpenseCategory> = {
  transport_international: "transport",
  transport_local: "transport",
  vehicule: "transport",
  assurance: "administratif_sante",
  visas: "administratif_sante",
  vaccins: "administratif_sante",
  administratif: "administratif_sante",
  financement: "administratif_sante",
  imprevus: "administratif_sante",
  frais_bancaires: "administratif_sante",
};

/** Sous-type déduit pour le regroupement (voir LEGACY_CATEGORY_GROUP) : une ancienne catégorie
 * comme "visas" ou "assurance" devient le sous-type "visa"/"assurance" une fois rattachée à
 * "administratif_sante", pour ne perdre aucun détail lors de la bascule vers l'ancienne saisie. */
const LEGACY_SUB_CATEGORY: Record<string, string> = {
  assurance: "assurance",
  visas: "visa",
  vaccins: "vaccin",
  frais_bancaires: "frais_bancaires",
  imprevus: "imprevus",
};

/** Catégorie unifiée effective d'une dépense (identité pour les nouvelles valeurs, regroupée
 * pour les anciennes) — à utiliser pour tout graphique ou regroupement par catégorie. */
export function groupedCategory(category: ExpenseCategory): ExpenseCategory {
  return LEGACY_CATEGORY_GROUP[category] ?? category;
}

/** Sous-type effectif d'une dépense (le `sub_category` saisi, ou déduit de l'ancienne catégorie,
 * ou "autre" à défaut) — à utiliser pour les graphiques de détail (transport, administratif & santé). */
export function groupedSubCategory(e: { category: ExpenseCategory; sub_category: string | null }): string {
  return e.sub_category || LEGACY_SUB_CATEGORY[e.category] || "autre";
}

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
  /** Sous-type libre (mode de transport, type de frais administratif/santé) ; null/absent = sans sous-type. */
  sub_category?: string | null;
  planned: boolean;
  amount: number;
  currency: string;
  manual_rate_to_reference: number;
  description?: string;
  expense_date?: string;
  person_id?: string | null;
  /** Vrai tant que le montant est piloté par l'estimation automatique (voir EditableExpenseAmount) :
   * il continue alors à se resynchroniser avec l'estimation ; faux dès qu'il est ajusté à la main. */
  is_estimated?: boolean;
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
