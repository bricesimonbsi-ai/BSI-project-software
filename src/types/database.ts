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
  icon: string | null;
  status: CategoryStatus;
  position: number;
  module_key: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  category_id: string;
  title: string;
  icon: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_planned: number | null;
  budget_actual: number | null;
  currency: string;
  status: ProjectStatus;
  /** Modèle choisi à la création pour un projet de la catégorie "Médias" (Films/Séries/Jeux
   * vidéo) — détermine les onglets et la source de recherche affichés ; null pour tout autre
   * projet. */
  media_type: MediaType | null;
  /** Présence = partage public de la synthèse (notes/commentaires) active (lien
   * /media/{token}, aucune authentification requise pour le visiteur) ; null = désactivé. */
  media_share_token: string | null;
  /** Modèle choisi à la création pour un projet de la catégorie "Bars & Restaurants" — même
   * principe que media_type ; null pour les projets créés avant cette distinction (comportement
   * mixte bar+restaurant inchangé) ou pour tout autre projet. */
  restaurant_type: RestaurantType | null;
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

/** Un événement de l'agenda partageable — libre, indépendant de tout projet, appartenant à un
 * compte (owner_id) plutôt qu'à un projet. */
export type AgendaEvent = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** Une personne (répertoire "people") participant à un événement — plusieurs par événement. */
export type AgendaEventParticipant = {
  id: string;
  event_id: string;
  person_id: string;
};

/** Collaborateur ayant accès à l'agenda d'un compte — même principe que ProjectCollaborator, mais
 * indexé par owner_id (le compte propriétaire) plutôt que par project_id. */
export type AgendaCollaborator = {
  id: string;
  owner_id: string;
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
  /** Présence = partage public du journal actif (lien /journal/{token}, aucune authentification
   * requise pour le visiteur) ; null = partage désactivé. */
  journal_share_token: string | null;
  created_at: string;
  updated_at: string;
};

/** Une publication du journal de voyage (façon Polarsteps) : photos + texte libre, rattachée en
 * option à une ville de l'itinéraire. */
export type VoyageJournalPost = {
  id: string;
  voyage_id: string;
  author_id: string | null;
  author_name: string;
  sous_etape_id: string | null;
  caption: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
};

export type VoyageJournalPhoto = {
  id: string;
  post_id: string;
  storage_path: string;
  position: number;
  created_at: string;
};

/** Ligne renvoyée par la fonction publique get_public_journal (page de partage sans authentification). */
export type PublicJournalEntry = {
  post_id: string;
  caption: string | null;
  entry_date: string;
  created_at: string;
  author_name: string;
  city: string | null;
  country_region: string | null;
  photo_paths: string[];
  latitude: number | null;
  longitude: number | null;
};

/** Ligne renvoyée par get_public_journal_meta. */
export type PublicJournalMeta = {
  voyage_id: string;
  title: string;
  icon: string | null;
  start_date: string | null;
  end_date: string | null;
};

/** Ligne renvoyée par get_public_journal_travelers. */
export type PublicJournalTraveler = {
  name: string;
  avatar_emoji: string | null;
  avatar_config: PersonAvatarConfig | null;
};

/** Réaction (emoji) d'un visiteur du journal sur une publication — un visiteur (identifié par
 * son prénom) n'a qu'une seule réaction active par publication. */
export type JournalPostReaction = {
  post_id: string;
  emoji: string;
  visitor_name: string;
};

/** Commentaire (visiteur ou réponse de l'auteur du voyage, `is_owner_reply`) sur une publication
 * du journal. `parent_comment_id` non nul = réponse imbriquée sous ce commentaire. */
export type JournalPostComment = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_name: string;
  is_owner_reply: boolean;
  content: string;
  created_at: string;
};

/** Réaction (emoji) sur un commentaire du journal — `is_owner` = réaction de l'auteur/collaborateur
 * du voyage (identité connue), sinon d'un visiteur anonyme identifié par son prénom. */
export type JournalCommentReaction = {
  comment_id: string;
  emoji: string;
  visitor_name: string;
  is_owner: boolean;
};

/** Un article d'une liste de courses (projet de la catégorie "Courses"). */
export type ShoppingListItem = {
  id: string;
  project_id: string;
  name: string;
  quantity: string | null;
  icon: string | null;
  category: string | null;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type MediaType = "film" | "serie" | "jeu";

/** Un contenu suivi (film/série/jeu) dans un projet de la catégorie "Séries, Films et Jeux vidéo". */
export type MediaItem = {
  id: string;
  project_id: string;
  type: MediaType;
  external_id: string | null;
  title: string;
  poster_path: string | null;
  synopsis: string | null;
  release_date: string | null;
  external_rating: number | null;
  /** @deprecated Remplacé par `platforms` (liste). Reste en base (migration additive), plus lu
   * ni écrit par l'application. */
  platform: string | null;
  /** Où le voir (streaming, auto-récupéré via TMDB pour film/série) ou sur quelle console y jouer
   * (jeu, sélection manuelle) — plusieurs valeurs possibles. */
  platforms: string[];
  watched: boolean;
  watched_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

/** Une personne (répertoire "people") ayant vu/joué un contenu — plusieurs par contenu possibles. */
export type MediaItemWatcher = {
  id: string;
  media_item_id: string;
  person_id: string;
  created_at: string;
};

/** Note personnelle (/10) + commentaire libre d'une personne sur un contenu — une par personne et
 * par contenu, modifiable dans le temps (jamais un historique). */
export type MediaItemRating = {
  id: string;
  media_item_id: string;
  person_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

/** Ligne renvoyée par get_public_media_meta (partage public de la synthèse). */
export type PublicMediaMeta = {
  project_id: string;
  title: string;
  icon: string | null;
  media_type: MediaType;
};

/** Une note/commentaire individuel dans le détail d'un contenu de la synthèse publique. */
export type PublicMediaRatingEntry = {
  person_name: string;
  rating: number;
  comment: string | null;
};

/** Ligne renvoyée par get_public_media_synthesis : un contenu noté (au moins une fois), avec le
 * détail par personne. */
export type PublicMediaSynthesisItem = {
  item_id: string;
  title: string;
  poster_path: string | null;
  media_type: MediaType;
  release_date: string | null;
  external_rating: number | null;
  avg_rating: number;
  ratings: PublicMediaRatingEntry[];
};

export type RestaurantType = "bar" | "restaurant";

/** Un bar/restaurant suivi dans un projet de la catégorie "Bars & Restaurants". "Où" est récupéré
 * automatiquement via Google Places (adresse, photo, note, horaires...) quand la clé est
 * configurée, sinon saisi manuellement (name/address uniquement). */
export type RestaurantItem = {
  id: string;
  project_id: string;
  place_id: string | null;
  name: string;
  address: string | null;
  categories: string[];
  photo_url: string | null;
  google_rating: number | null;
  price_level: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string[];
  latitude: number | null;
  longitude: number | null;
  visited: boolean;
  visited_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

/** Une personne (répertoire "people") ayant testé un lieu — plusieurs par lieu possibles. */
export type RestaurantItemVisitor = {
  id: string;
  restaurant_item_id: string;
  person_id: string;
  created_at: string;
};

/** Note personnelle (/10) + commentaire libre d'une personne sur un lieu — une par personne et par
 * lieu, modifiable dans le temps (jamais un historique). */
export type RestaurantItemRating = {
  id: string;
  restaurant_item_id: string;
  person_id: string;
  rating: number;
  comment: string | null;
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

/** Configuration d'un avatar généré (DiceBear, style avataaars) : couleurs/coiffure/accessoire
 * choisis par l'utilisateur, le reste (yeux, bouche, vêtements...) reste dérivé du seed (id de
 * la personne) pour rester visuellement stable d'un rendu à l'autre. Couleurs en hexadécimal
 * sans le "#". `accessories: null` = aucun accessoire. */
export type PersonAvatarConfig = {
  gender: "homme" | "femme";
  skinColor: string;
  hairColor: string;
  top: string;
  accessories: string | null;
};

/** Personne référencée globalement (nom + avatar), paramétrable pour tout le portefeuille,
 * associable à n'importe quel projet via `ProjectPerson`. */
export type Person = {
  id: string;
  created_by: string;
  name: string;
  avatar_emoji: string | null;
  avatar_config: PersonAvatarConfig | null;
  /** Couleur manuelle (index 0-5 dans AVATAR_COLOR_CLASSES) ; null = couleur positionnelle
   * automatique (comportement historique, dérivée de la place dans la liste). */
  color_index: number | null;
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

/** Préférence granulaire pour un type de notification donné, sur un projet donné — absence de
 * ligne = notification active (comportement par défaut), une ligne enabled=false la désactive. */
export type NotificationTypePreference = {
  user_id: string;
  notification_type: string;
  project_id: string;
  enabled: boolean;
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

export type GiftOccasion = "anniversaire" | "noel" | "autre";
export type GiftStatus = "idee" | "achete" | "offert";

/** Une idée de cadeau dans un projet de la catégorie "Cadeaux" — la personne visée (facultative)
 * vient du répertoire "Personnes" déjà existant, pas d'une table dédiée. */
export type GiftItem = {
  id: string;
  project_id: string;
  title: string;
  person_id: string | null;
  occasion: GiftOccasion;
  status: GiftStatus;
  price_estimate: number | null;
  link: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
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
      notification_type_preferences: Table<NotificationTypePreference>;
      voyage_journal_posts: Table<VoyageJournalPost>;
      voyage_journal_photos: Table<VoyageJournalPhoto>;
      journal_post_reactions: Table<JournalPostReaction>;
      journal_post_comments: Table<JournalPostComment>;
      journal_comment_reactions: Table<JournalCommentReaction>;
      shopping_list_items: Table<ShoppingListItem>;
      media_items: Table<MediaItem>;
      media_item_watchers: Table<MediaItemWatcher>;
      media_item_ratings: Table<MediaItemRating>;
      restaurant_items: Table<RestaurantItem>;
      restaurant_item_visitors: Table<RestaurantItemVisitor>;
      restaurant_item_ratings: Table<RestaurantItemRating>;
      agenda_events: Table<AgendaEvent>;
      agenda_event_participants: Table<AgendaEventParticipant>;
      agenda_collaborators: Table<AgendaCollaborator>;
      gift_items: Table<GiftItem>;
    };
    Views: {
      voyage_budget_summary: { Row: VoyageBudgetSummary; Relationships: [] };
      voyage_etape_budget_summary: { Row: VoyageEtapeBudgetSummary; Relationships: [] };
      voyage_category_budget_summary: { Row: VoyageCategoryBudgetSummary; Relationships: [] };
      voyage_traveler_expense_summary: { Row: VoyageTravelerExpenseSummary; Relationships: [] };
      voyage_person_expense_summary: { Row: VoyagePersonExpenseSummary; Relationships: [] };
      voyage_all_expenses: { Row: VoyageAllExpense; Relationships: [] };
    };
    Functions: {
      get_public_journal: {
        Args: { p_share_token: string };
        Returns: PublicJournalEntry[];
      };
      get_public_journal_meta: {
        Args: { p_share_token: string };
        Returns: PublicJournalMeta[];
      };
      get_public_journal_travelers: {
        Args: { p_share_token: string };
        Returns: PublicJournalTraveler[];
      };
      get_public_journal_reactions: {
        Args: { p_share_token: string };
        Returns: JournalPostReaction[];
      };
      set_public_journal_reaction: {
        Args: { p_share_token: string; p_post_id: string; p_visitor_name: string; p_emoji: string };
        Returns: undefined;
      };
      remove_public_journal_reaction: {
        Args: { p_share_token: string; p_post_id: string; p_visitor_name: string };
        Returns: undefined;
      };
      get_public_journal_comments: {
        Args: { p_share_token: string };
        Returns: JournalPostComment[];
      };
      add_public_journal_comment: {
        Args: {
          p_share_token: string;
          p_post_id: string;
          p_visitor_name: string;
          p_content: string;
          p_parent_comment_id: string | null;
        };
        Returns: string;
      };
      get_public_journal_comment_reactions: {
        Args: { p_share_token: string };
        Returns: JournalCommentReaction[];
      };
      set_public_journal_comment_reaction: {
        Args: { p_share_token: string; p_comment_id: string; p_visitor_name: string; p_emoji: string };
        Returns: undefined;
      };
      remove_public_journal_comment_reaction: {
        Args: { p_share_token: string; p_comment_id: string; p_visitor_name: string };
        Returns: undefined;
      };
      get_public_media_meta: {
        Args: { p_share_token: string };
        Returns: PublicMediaMeta[];
      };
      get_public_media_synthesis: {
        Args: { p_share_token: string };
        Returns: PublicMediaSynthesisItem[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
