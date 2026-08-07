// Types du schéma Supabase, écrits à la main pour correspondre aux migrations
// SQL (supabase/migrations). À régénérer via `supabase gen types typescript`
// une fois la CLI connectée au projet, si souhaité.
//
// Remarque : ces types utilisent `type` (pas `interface`) car TypeScript ne
// considère pas qu'une interface satisfasse un `Record<string, unknown>` dans
// les vérifications de contrainte générique — ce qui casse le typage des
// méthodes .insert()/.update() de supabase-js si on utilise des interfaces ici.

export type Permission = "read" | "write";
export type ProjectStatus = "active" | "upcoming" | "completed" | "archived";
export type CategoryStatus = "active" | "archived";
export type ExpenseCategory =
  // Catégories unifiées (voir use-expenses.ts pour la liste affichée dans l'UI)
  | "transport"
  | "logement"
  | "nourriture"
  | "activites"
  | "equipement"
  | "administratif_sante"
  // Dépense importée (voir expense-import-dialog.tsx) sans catégorie choisie à l'import, en
  // attente d'être affectée depuis l'onglet "Gérer mes dépenses" — jamais proposée à la saisie
  // manuelle normale (voir EXPENSE_CATEGORIES dans use-expenses.ts).
  | "non_categorise"
  // Anciennes valeurs, conservées uniquement pour les dépenses déjà saisies avant l'unification
  | "transport_international"
  | "transport_local"
  | "assurance"
  | "visas"
  | "vaccins"
  | "administratif"
  | "vehicule"
  | "financement"
  | "imprevus"
  | "frais_bancaires";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  status: CategoryStatus;
  position: number;
  module_key: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_planned: number | null;
  budget_actual: number | null;
  currency: string;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectCollaborator = {
  id: string;
  project_id: string;
  email: string;
  user_id: string | null;
  permission: Permission;
  invited_by: string;
  created_at: string;
};

export type TodoCategory = "visa" | "vaccin" | "permis" | "materiel" | "itineraire" | "autre";

export type Todo = {
  id: string;
  project_id: string | null;
  title: string;
  done: boolean;
  due_date: string | null;
  assignee_id: string | null;
  /** Personne (répertoire "people", ex. un voyageur) à qui la tâche est assignée ; null si non
   * assignée à une personne précise (voir aussi `assigned_to_all`). */
  assigned_person_id: string | null;
  /** Vrai = assignée à tous les voyageurs/personnes du projet plutôt qu'à une personne précise ;
   * mutuellement exclusif avec `assigned_person_id` (géré côté application). */
  assigned_to_all: boolean;
  category: TodoCategory | null;
  auto_generated: boolean;
  source_etape_id: string | null;
  source_equipment_id: string | null;
  dedup_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TravelStyle = "economique" | "standard" | "confort";

export type Voyage = {
  id: string;
  project_id: string;
  start_date: string | null;
  end_date: string | null;
  adults_count: number;
  children_count: number;
  reference_currency: string;
  lodging_count: number | null;
  travel_style: TravelStyle | null;
  budget_target_per_person: number | null;
  /** % de répartition d'un retrait d'espèces entre les 3 catégories "sur place" à l'import CSV
   * (voir expense-import-dialog.tsx) — mémorisé une fois par voyage, réutilisé à chaque import. */
  cash_split_ratios: { transport_local: number; activites: number; nourriture: number };
  created_at: string;
  updated_at: string;
};

/** @deprecated Remplacé par `Person` (liste globale, paramétrable pour toute l'application) +
 * `ProjectPerson`. Le type et la table restent en base (migration additive) mais ne sont plus
 * utilisés par l'application. */
export type VoyageTraveler = {
  id: string;
  voyage_id: string;
  name: string;
  avatar_emoji: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

/** Personne référencée globalement (nom + avatar), paramétrable pour tout le portefeuille,
 * associable à n'importe quel projet via `ProjectPerson`. */
export type Person = {
  id: string;
  created_by: string;
  name: string;
  avatar_emoji: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type ProjectPerson = {
  id: string;
  project_id: string;
  person_id: string;
  /** Budget cible pour CETTE personne sur CE projet (EUR) ; null = pas encore renseigné. Propre
   * au lien personne <-> projet (pas à la personne elle-même), une même personne pouvant avoir
   * une cible différente d'un voyage à l'autre. */
  budget_target: number | null;
  created_at: string;
};

/** Code couleur climatique par mois (index 0 = janvier). */
export type ClimateRating = "good" | "mid" | "bad";

export type VoyageEtape = {
  id: string;
  voyage_id: string;
  country_region: string;
  arrival_date: string | null;
  duration_days: number | null;
  visa_needed: boolean;
  vaccines: string | null;
  transport_mode: string | null;
  intl_permit_needed: boolean;
  security_notes: string | null;
  notes: string | null;
  order_index: number;
  latitude: number | null;
  longitude: number | null;
  climate_by_month: ClimateRating[] | null;
  /** @deprecated Les taux journaliers sont désormais overridables par VILLE, pas par pays (voir
   * les mêmes champs sur VoyageSousEtape) — ces colonnes restent en base pour ne pas perdre
   * d'anciennes valeurs déjà saisies, mais l'application n'y écrit plus. */
  lodging_cost_per_night: number | null;
  /** @deprecated voir lodging_cost_per_night. */
  food_cost_per_day: number | null;
  /** @deprecated voir lodging_cost_per_night. */
  local_transport_cost_per_day: number | null;
  created_at: string;
  updated_at: string;
};

export type VoyageSousEtape = {
  id: string;
  etape_id: string;
  city: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  lodging: string | null;
  activities: string | null;
  transport_next_mode: string | null;
  transport_next_duration_hours: number | null;
  transport_next_cost: number | null;
  transport_next_currency: string | null;
  order_index: number;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  climate_by_month: ClimateRating[] | null;
  /** Override manuel du tarif hébergement/nuit pour CETTE ville (EUR) ; null = estimation
   * automatique (coût de la vie par pays). Propre à la ville, pas partagé avec les autres villes
   * du même pays. */
  lodging_cost_per_night: number | null;
  /** Override manuel du tarif nourriture/jour et par personne pour cette ville (EUR) ; null =
   * estimation auto. */
  food_cost_per_day: number | null;
  /** Override manuel du forfait transport sur place, par jour et par personne, pour cette ville
   * (EUR) ; null = forfait par défaut (voir DEFAULT_LOCAL_TRANSPORT_EUR_PER_DAY). */
  local_transport_cost_per_day: number | null;
  created_at: string;
  updated_at: string;
};

/** Article de matériel coché pour un voyage (catalogue de base statique, voir
 * equipment-catalog.ts) ; l'absence de ligne = article non coché. */
export type VoyageEquipment = {
  id: string;
  voyage_id: string;
  category: string;
  name: string;
  quantity: number;
  /** Prix unitaire estimé (EUR), ajustable ; null = utilise le tarif indicatif par défaut. */
  unit_price: number | null;
  /** Déjà possédé (rien à acheter) : pas de coût, pas de tâche automatique — sert juste de
   * pense-bête "à emporter". */
  owned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type VoyageExpense = {
  id: string;
  voyage_id: string | null;
  sous_etape_id: string | null;
  /** Rattachement au niveau pays (ex. visa), en plus de voyage_id (transverse) et
   * sous_etape_id (ville) — un seul des trois est renseigné. */
  etape_id: string | null;
  /** @deprecated voir Person/ProjectPerson. */
  traveler_id: string | null;
  person_id: string | null;
  category: ExpenseCategory;
  /** Sous-type libre (mode de transport, type de frais administratif/santé) ; null = sans sous-type. */
  sub_category: string | null;
  planned: boolean;
  amount: number;
  currency: string;
  manual_rate_to_reference: number;
  /** Vrai tant que le montant est piloté par l'estimation automatique (voir EditableExpenseAmount). */
  is_estimated: boolean;
  /** Origine d'une dépense importée depuis un relevé bancaire (voir expense-import-dialog.tsx) —
   * "carte" pour une ligne carte directe, "retrait" pour une part ventilée d'un retrait
   * d'espèces ; null pour toute dépense saisie manuellement (aucune pastille affichée). */
  source: "carte" | "retrait" | null;
  /** Vrai tant qu'une dépense importée n'a pas été vérifiée manuellement (pastille "à valider"). */
  needs_review: boolean;
  description: string | null;
  expense_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** Vue de détail plate (voir voyage_all_expenses) : une ligne par dépense, quel que soit son
 * niveau de rattachement, avec le voyage/pays/ville déjà résolus. */
export type VoyageAllExpense = VoyageExpense & {
  resolved_voyage_id: string | null;
  resolved_etape_id: string | null;
  country_region: string | null;
  city_name: string | null;
};

export type DocumentRow = {
  id: string;
  project_id: string;
  voyage_etape_id: string | null;
  storage_path: string;
  name: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  push_enabled: boolean;
  email_fallback_enabled: boolean;
  updated_at: string;
};

export type VoyageBudgetSummary = {
  voyage_id: string;
  project_id: string;
  total_planned: number | null;
  total_actual: number | null;
};

export type VoyageEtapeBudgetSummary = {
  etape_id: string;
  voyage_id: string;
  total_planned: number | null;
  total_actual: number | null;
};

export type VoyageCategoryBudgetSummary = {
  voyage_id: string;
  category: ExpenseCategory;
  total_planned: number | null;
  total_actual: number | null;
};

/** @deprecated Remplacé par VoyagePersonExpenseSummary. */
export type VoyageTravelerExpenseSummary = {
  traveler_id: string;
  voyage_id: string;
  name: string;
  total_planned: number | null;
  total_actual: number | null;
};

export type VoyagePersonExpenseSummary = {
  person_id: string;
  voyage_id: string;
  name: string;
  total_planned: number | null;
  total_actual: number | null;
};

type Table<Row, InsertShape = Partial<Row>> = {
  Row: Row;
  Insert: InsertShape;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      categories: Table<Category>;
      projects: Table<Project>;
      project_collaborators: Table<ProjectCollaborator>;
      todos: Table<Todo>;
      voyages: Table<Voyage>;
      voyage_etapes: Table<VoyageEtape>;
      voyage_sous_etapes: Table<VoyageSousEtape>;
      voyage_expenses: Table<VoyageExpense>;
      voyage_equipment: Table<VoyageEquipment>;
      voyage_travelers: Table<VoyageTraveler>;
      people: Table<Person>;
      project_people: Table<ProjectPerson>;
      documents: Table<DocumentRow>;
      notifications: Table<NotificationRow>;
      notification_preferences: Table<NotificationPreferences>;
    };
    Views: {
      voyage_budget_summary: { Row: VoyageBudgetSummary; Relationships: [] };
      voyage_etape_budget_summary: { Row: VoyageEtapeBudgetSummary; Relationships: [] };
      voyage_category_budget_summary: { Row: VoyageCategoryBudgetSummary; Relationships: [] };
      voyage_traveler_expense_summary: { Row: VoyageTravelerExpenseSummary; Relationships: [] };
      voyage_person_expense_summary: { Row: VoyagePersonExpenseSummary; Relationships: [] };
      voyage_all_expenses: { Row: VoyageAllExpense; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
