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
  | "equipement"
  | "transport_international"
  | "assurance"
  | "visas"
  | "vaccins"
  | "administratif"
  | "vehicule"
  | "financement"
  | "imprevus"
  | "frais_bancaires"
  | "logement"
  | "nourriture"
  | "activites"
  | "transport_local";

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
  category: TodoCategory | null;
  auto_generated: boolean;
  source_etape_id: string | null;
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
  /** Override manuel du tarif hébergement/nuit utilisé dans l'estimation budgétaire pour ce
   * pays (EUR) ; null = utiliser l'estimation automatique (coût de la vie par pays). */
  lodging_cost_per_night: number | null;
  /** Override manuel du tarif nourriture/jour et par personne (EUR) ; null = estimation auto. */
  food_cost_per_day: number | null;
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
  created_at: string;
  updated_at: string;
};

export type VoyageExpense = {
  id: string;
  voyage_id: string | null;
  sous_etape_id: string | null;
  /** @deprecated voir Person/ProjectPerson. */
  traveler_id: string | null;
  person_id: string | null;
  category: ExpenseCategory;
  planned: boolean;
  amount: number;
  currency: string;
  manual_rate_to_reference: number;
  description: string | null;
  expense_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
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
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
