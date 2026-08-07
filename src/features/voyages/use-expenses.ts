import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
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

/** Sous-type libre (`sub_category`) proposé quand la catégorie est "transport". "sur_place" est
 * réservé à la ligne auto-calculée "Transport sur place" (voir SousEtapeDialog) — distincte du
 * trajet vers la ville suivante bien que dans la même catégorie unifiée "transport". */
export const TRANSPORT_SUB_CATEGORIES: { value: string; label: string }[] = [
  { value: "avion", label: "Avion" },
  { value: "train", label: "Train" },
  { value: "bus", label: "Bus" },
  { value: "taxi", label: "Taxi / VTC" },
  { value: "voiture", label: "Voiture" },
  { value: "ferry_bateau", label: "Ferry / Bateau" },
  { value: "sur_place", label: "Transport sur place" },
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

/** Sous-catégories affichées dans la grille "Administratif & santé" transverse au voyage — le
 * visa a sa propre estimation, rattachée au pays qui le nécessite (voir etape-dialog.tsx), donc
 * exclue ici pour ne pas la confondre avec les frais transverses au voyage entier. */
export const ADMIN_SANTE_DISPLAYED_SUB_CATEGORIES = ADMIN_SANTE_SUB_CATEGORIES.filter((s) => s.value !== "visa");

/** Détail prévisionnel "Administratif & santé" transverse au voyage, un montant par
 * sous-catégorie affichée — toujours la PREMIÈRE ligne trouvée pour cette sous-catégorie, jamais
 * une somme de toutes les lignes correspondantes en base : sinon d'éventuelles anciennes lignes
 * en double (devenues invisibles dans la grille) gonflent le montant sans qu'on puisse comprendre
 * pourquoi. Source unique utilisée par le tableau détail des dépenses ET le résumé/graphique du
 * budget (total et détail par anneau), pour qu'ils affichent toujours exactement les mêmes
 * chiffres. */
export function computeAdminSantePlannedBySubCategory(
  expenses: VoyageAllExpense[],
  voyageId: string
): { key: string; label: string; amount: number }[] {
  const adminRows = expenses.filter((e) => e.voyage_id === voyageId && groupedCategory(e.category) === "administratif_sante");
  return ADMIN_SANTE_DISPLAYED_SUB_CATEGORIES.map((s) => {
    const row = adminRows.find((e) => e.planned && (e.sub_category || "") === s.value);
    return { key: s.value, label: s.label, amount: row ? row.amount * row.manual_rate_to_reference : 0 };
  }).filter((r) => r.amount > 0);
}

/** Total prévisionnel "Administratif & santé" = somme du détail par sous-catégorie ci-dessus. */
export function computeAdminSantePlannedTotal(expenses: VoyageAllExpense[], voyageId: string): number {
  return computeAdminSantePlannedBySubCategory(expenses, voyageId).reduce((sum, r) => sum + r.amount, 0);
}

/** Total prévisionnel des visas, à part : contrairement aux autres sous-catégories "Administratif
 * & santé" (transverses au voyage entier, un seul montant possible), le visa est saisi PAR PAYS
 * (voir etape-dialog.tsx) — plusieurs lignes légitimes peuvent donc coexister, une par pays qui en
 * nécessite un, et doivent être SOMMÉES (pas dédupliquées à la première trouvée comme les autres
 * sous-catégories). Dédupliqué uniquement par pays (première ligne trouvée par étape), pour ne
 * jamais compter deux fois une éventuelle ligne en double au sein d'un même pays. */
export function computeAdminSanteVisaPlannedTotal(expenses: VoyageAllExpense[]): number {
  const byEtape = new Map<string, VoyageAllExpense>();
  for (const e of expenses) {
    if (!e.planned || !e.resolved_etape_id || groupedCategory(e.category) !== "administratif_sante") continue;
    if ((e.sub_category || "") !== "visa") continue;
    if (!byEtape.has(e.resolved_etape_id)) byEtape.set(e.resolved_etape_id, e);
  }
  return Array.from(byEtape.values()).reduce((sum, e) => sum + e.amount * e.manual_rate_to_reference, 0);
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
        // Toute recherche de la "première" ligne pour une catégorie/sous-catégorie donnée
        // (voir EditableExpenseAmount, budget-overview-table.tsx...) dépend de cet ordre : sans
        // second critère, deux lignes avec le même expense_date (souvent toutes les deux null,
        // aucun champ de saisie rapide ne renseigne cette date) n'ont AUCUN ordre garanti par
        // Postgres — d'éventuelles lignes en double (historiques ou futures) pouvaient donc
        // remonter tantôt l'une tantôt l'autre selon le hasard du plan de requête, avec des
        // montants incohérents d'un chargement à l'autre. Les saisies manuelles (is_estimated =
        // faux) gagnent toujours sur les estimations automatiques, puis la plus récente gagne —
        // un ordre stable et reproductible à chaque fois.
        .order("expense_date", { ascending: false })
        .order("is_estimated", { ascending: true })
        .order("created_at", { ascending: false });
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
        // Toute recherche de la "première" ligne pour une catégorie/sous-catégorie donnée
        // (voir EditableExpenseAmount, budget-overview-table.tsx...) dépend de cet ordre : sans
        // second critère, deux lignes avec le même expense_date (souvent toutes les deux null,
        // aucun champ de saisie rapide ne renseigne cette date) n'ont AUCUN ordre garanti par
        // Postgres — d'éventuelles lignes en double (historiques ou futures) pouvaient donc
        // remonter tantôt l'une tantôt l'autre selon le hasard du plan de requête, avec des
        // montants incohérents d'un chargement à l'autre. Les saisies manuelles (is_estimated =
        // faux) gagnent toujours sur les estimations automatiques, puis la plus récente gagne —
        // un ordre stable et reproductible à chaque fois.
        .order("expense_date", { ascending: false })
        .order("is_estimated", { ascending: true })
        .order("created_at", { ascending: false });
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
        // Toute recherche de la "première" ligne pour une catégorie/sous-catégorie donnée
        // (voir EditableExpenseAmount, budget-overview-table.tsx...) dépend de cet ordre : sans
        // second critère, deux lignes avec le même expense_date (souvent toutes les deux null,
        // aucun champ de saisie rapide ne renseigne cette date) n'ont AUCUN ordre garanti par
        // Postgres — d'éventuelles lignes en double (historiques ou futures) pouvaient donc
        // remonter tantôt l'une tantôt l'autre selon le hasard du plan de requête, avec des
        // montants incohérents d'un chargement à l'autre. Les saisies manuelles (is_estimated =
        // faux) gagnent toujours sur les estimations automatiques, puis la plus récente gagne —
        // un ordre stable et reproductible à chaque fois.
        .order("expense_date", { ascending: false })
        .order("is_estimated", { ascending: true })
        .order("created_at", { ascending: false });
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
        // Toute recherche de la "première" ligne pour une catégorie/sous-catégorie donnée
        // (voir EditableExpenseAmount, budget-overview-table.tsx...) dépend de cet ordre : sans
        // second critère, deux lignes avec le même expense_date (souvent toutes les deux null,
        // aucun champ de saisie rapide ne renseigne cette date) n'ont AUCUN ordre garanti par
        // Postgres — d'éventuelles lignes en double (historiques ou futures) pouvaient donc
        // remonter tantôt l'une tantôt l'autre selon le hasard du plan de requête, avec des
        // montants incohérents d'un chargement à l'autre. Les saisies manuelles (is_estimated =
        // faux) gagnent toujours sur les estimations automatiques, puis la plus récente gagne —
        // un ordre stable et reproductible à chaque fois.
        .order("expense_date", { ascending: false })
        .order("is_estimated", { ascending: true })
        .order("created_at", { ascending: false });
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
  /** Origine d'une dépense importée (voir expense-import-dialog.tsx) ; jamais définie pour une
   * saisie manuelle. */
  source?: "carte" | "retrait" | null;
  /** Pastille "à valider" (voir expense-import-dialog.tsx) ; passer `false` pour valider. */
  needs_review?: boolean;
};

/** Une dépense peut être affichée à travers plusieurs requêtes différentes selon l'endroit
 * (vue d'ensemble du voyage, dialogue d'une ville, dialogue d'un pays...) : on invalide donc
 * systématiquement TOUTES les clés de requête de dépenses, pas seulement celle passée en
 * paramètre, pour qu'une modification faite n'importe où se reflète immédiatement partout
 * ailleurs sans avoir à revisiter l'onglet concerné. Exportée pour que les mutations qui
 * suppriment/modifient un pays ou une ville (dont les dépenses cascadent en base) invalident
 * les mêmes clés — sinon le total prévisionnel reste basé sur un cache périmé jusqu'à ce qu'un
 * refetch sans rapport se déclenche par hasard. */
export function invalidateAllExpenseQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["voyage-budget-summary"] });
  queryClient.invalidateQueries({ queryKey: ["etape-budget-summary"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-category-budget-summary"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-person-expense-summary"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-all-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["etape-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["sous-etape-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["voyage-expenses"] });
}

function invalidateBudgetQueries(queryClient: ReturnType<typeof useQueryClient>, invalidateKey: unknown[]) {
  queryClient.invalidateQueries({ queryKey: invalidateKey });
  invalidateAllExpenseQueries(queryClient);
}

/** Toute mutation de dépense qui échoue (RLS, contrainte, réseau...) doit rester visible : sans
 * ceci, un enregistrement en échec semblait "ne rien faire" (montant tapé jamais confirmé, sans
 * aucun message), impossible à distinguer d'un montant simplement pas encore rechargé. */
function onExpenseMutationError(err: unknown) {
  toast({ title: "Erreur lors de l'enregistrement de la dépense", description: (err as Error).message, variant: "destructive" });
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
    onError: onExpenseMutationError,
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
    onError: onExpenseMutationError,
  });
}

/** Rattache une dépense "non affectée à une ville" (voir expense-import-dialog.tsx : un import
 * CSV peut laisser une dépense sans ville si aucune suggestion n'était fiable) à une ville —
 * seul moyen de sortir de cet état, `useUpdateExpense` ne touchant jamais au rattachement. */
export function useAssignExpenseToCity(invalidateKey: unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sousEtapeId }: { id: string; sousEtapeId: string }) => {
      const { error } = await supabase.from("voyage_expenses").update({ sous_etape_id: sousEtapeId, voyage_id: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBudgetQueries(queryClient, invalidateKey),
    onError: onExpenseMutationError,
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
    onError: onExpenseMutationError,
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
