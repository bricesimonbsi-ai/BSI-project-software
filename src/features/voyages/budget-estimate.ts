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

/** Une tranche de distance et son tarif (EUR/km/passager) ; `maxKm: null` = tranche la plus
 * haute (au-delà de la précédente), les tranches doivent être triées par maxKm croissant. */
type DistanceTier = { maxKm: number | null; perKm: number };

/** Grille tarifaire par mode de transport et tranche de distance (EUR/km/passager), fournie
 * par l'utilisateur. Remplace l'ancien modèle "base fixe + tarif/km" par un tarif purement au
 * km, dégressif ou progressif selon le mode. */
const TRANSPORT_RATE_TIERS: Record<string, DistanceTier[]> = {
  avion: [
    { maxKm: 1000, perKm: 0.2 },
    { maxKm: 3000, perKm: 0.09 },
    { maxKm: null, perKm: 0.05 },
  ],
  train: [
    { maxKm: 200, perKm: 0.13 },
    { maxKm: 800, perKm: 0.12 },
    { maxKm: null, perKm: 0.25 },
  ],
  bus: [
    { maxKm: 300, perKm: 0.05 },
    { maxKm: null, perKm: 0.03 },
  ],
  taxi: [
    { maxKm: 20, perKm: 1.5 },
    { maxKm: 80, perKm: 1.3 },
    { maxKm: null, perKm: 1.2 },
  ],
  vtc: [
    { maxKm: 20, perKm: 1.5 },
    { maxKm: 80, perKm: 1.3 },
    { maxKm: null, perKm: 1.2 },
  ],
  bateau: [
    { maxKm: 150, perKm: 1.5 },
    { maxKm: null, perKm: 0.6 },
  ],
  ferry: [
    { maxKm: 150, perKm: 1.5 },
    { maxKm: null, perKm: 0.6 },
  ],
  voiture: [
    { maxKm: 300, perKm: 0.15 },
    { maxKm: null, perKm: 0.12 },
  ],
};
/** Repli neutre si le mode est inconnu ou "autre" : tarif voiture, le plus généraliste. */
const DEFAULT_TRANSPORT_TIERS = TRANSPORT_RATE_TIERS.voiture;

function rateForDistance(tiers: DistanceTier[], distanceKm: number): number {
  for (const tier of tiers) {
    if (tier.maxKm == null || distanceKm < tier.maxKm) return tier.perKm;
  }
  return tiers[tiers.length - 1].perKm;
}

/** Coût indicatif (EUR) du trajet vers l'étape suivante, selon la distance et le mode —
 * tarif/km/passager dégressif ou progressif par tranche de distance (voir TRANSPORT_RATE_TIERS). */
export function estimateTransportLegCost(distanceKm: number | null, mode: string | null, travelerCount = 1): number {
  if (!distanceKm) return 0;
  const key = mode?.toLowerCase() ?? "";
  const tiers = Object.entries(TRANSPORT_RATE_TIERS).find(([modeKey]) => key.includes(modeKey))?.[1] ?? DEFAULT_TRANSPORT_TIERS;
  return distanceKm * rateForDistance(tiers, distanceKm) * Math.max(1, travelerCount || 1);
}

/** Prix unitaire par défaut (EUR) proposé pour un article de matériel coché — une estimation
 * volontairement grossière (pas de prix par article dans le catalogue de base), à affiner
 * article par article dans l'onglet Équipement une fois les vrais achats/prix connus. */
export const DEFAULT_EQUIPMENT_UNIT_PRICE_EUR = 12;
