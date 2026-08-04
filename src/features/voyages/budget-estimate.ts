import type { TravelStyle } from "@/types/database";

export const TRAVEL_STYLE_OPTIONS: { value: TravelStyle; label: string }[] = [
  { value: "economique", label: "Économique (auberges, street food)" },
  { value: "standard", label: "Standard (hôtels 2-3*, restaurants simples)" },
  { value: "confort", label: "Confort / all inclusive (hôtels 4*+, activités)" },
];

/**
 * Tarifs indicatifs par jour et par personne, en EUR — un point de départ raisonnable pour
 * dégrossir un budget, pas un prix réel par pays (aucune API de coût de la vie en temps réel,
 * cohérent avec les choix déjà faits sur ce projet : formules simples plutôt que scraping fragile).
 */
const DAILY_RATES_EUR: Record<TravelStyle, { lodging: number; food: number }> = {
  economique: { lodging: 15, food: 12 },
  standard: { lodging: 45, food: 25 },
  confort: { lodging: 120, food: 50 },
};

/** Coût de visa indicatif par personne et par pays nécessitant un visa (EUR). */
const VISA_COST_ESTIMATE_EUR: Record<TravelStyle, number> = {
  economique: 40,
  standard: 60,
  confort: 90,
};

/** Coût aérien indicatif (EUR / km / personne), moyenne tous courriers confondus. */
const FLIGHT_COST_PER_KM_EUR = 0.11;

export type BudgetEstimate = {
  lodging: number;
  food: number;
  flights: number;
  visas: number;
  total: number;
};

/**
 * Estimation indicative du budget (hébergement, nourriture, vols inter-étapes, visas) à partir
 * de l'itinéraire saisi, d'un style de voyage et du nombre de voyageurs/logements. Toujours
 * exprimée en EUR (pas de taux de change automatique) : un point de départ à ajuster, jamais
 * un prix réel — les vrais montants se saisissent ensuite comme dépenses normales.
 */
export function estimateBudget(params: {
  totalNights: number;
  travelerCount: number;
  lodgingCount: number;
  flightKm: number;
  visaEtapeCount: number;
  style: TravelStyle;
}): BudgetEstimate {
  const rates = DAILY_RATES_EUR[params.style];
  const rooms = Math.max(1, params.lodgingCount || 1);
  const travelers = Math.max(1, params.travelerCount || 1);
  const lodging = params.totalNights * rooms * rates.lodging;
  const food = params.totalNights * travelers * rates.food;
  const flights = params.flightKm * FLIGHT_COST_PER_KM_EUR * travelers;
  const visas = params.visaEtapeCount * VISA_COST_ESTIMATE_EUR[params.style] * travelers;
  return { lodging, food, flights, visas, total: lodging + food + flights + visas };
}
