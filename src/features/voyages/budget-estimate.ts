import type { TravelStyle } from "@/types/database";

export const TRAVEL_STYLE_OPTIONS: { value: TravelStyle; label: string }[] = [
  { value: "economique", label: "Économique (auberges, street food)" },
  { value: "standard", label: "Standard (hôtels 2-3*, restaurants simples)" },
  { value: "confort", label: "Confort / all inclusive (hôtels 4*+, activités)" },
];

/** Coût de visa indicatif par personne et par pays nécessitant un visa (EUR). */
const VISA_COST_ESTIMATE_EUR: Record<TravelStyle, number> = {
  economique: 40,
  standard: 60,
  confort: 90,
};

/** Coût aérien indicatif (EUR / km / personne), moyenne tous courriers confondus. */
const FLIGHT_COST_PER_KM_EUR = 0.11;

export function estimateFlightsEur(flightKm: number, travelerCount: number): number {
  return flightKm * FLIGHT_COST_PER_KM_EUR * Math.max(1, travelerCount || 1);
}

export function estimateVisasEur(visaEtapeCount: number, style: TravelStyle, travelerCount: number): number {
  return visaEtapeCount * VISA_COST_ESTIMATE_EUR[style] * Math.max(1, travelerCount || 1);
}
