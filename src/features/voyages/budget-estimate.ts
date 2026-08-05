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

/** Coût de visa indicatif (EUR) pour un pays donné, tous voyageurs compris. */
export function estimateVisaCostEur(style: TravelStyle, travelerCount: number): number {
  return VISA_COST_ESTIMATE_EUR[style] * Math.max(1, travelerCount || 1);
}

/** Tarif indicatif (EUR/km + base fixe) par mode de transport, moyenne mondiale. */
const TRANSPORT_LEG_RATE_EUR: Record<string, { perKm: number; base: number }> = {
  avion: { perKm: 0.09, base: 60 },
  train: { perKm: 0.08, base: 5 },
  bus: { perKm: 0.04, base: 3 },
  voiture: { perKm: 0.12, base: 0 },
  ferry: { perKm: 0.15, base: 10 },
  bateau: { perKm: 0.15, base: 10 },
};
const DEFAULT_TRANSPORT_LEG_RATE = { perKm: 0.08, base: 5 };

/** Coût indicatif (EUR) du trajet vers l'étape suivante, selon la distance et le mode. */
export function estimateTransportLegCost(distanceKm: number | null, mode: string | null, travelerCount = 1): number {
  if (!distanceKm) return 0;
  const key = mode?.toLowerCase() ?? "";
  const rate = Object.entries(TRANSPORT_LEG_RATE_EUR).find(([modeKey]) => key.includes(modeKey))?.[1] ?? DEFAULT_TRANSPORT_LEG_RATE;
  return (rate.base + distanceKm * rate.perKm) * Math.max(1, travelerCount || 1);
}
