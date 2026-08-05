import type { TravelStyle } from "@/types/database";
import { estimateTransportLegCost } from "@/features/voyages/budget-estimate";

/** Cache en mémoire (par code pays ISO), pour éviter de répéter les appels pendant la session. */
const priceLevelCache = new Map<string, number | null>();

/**
 * Tarifs de référence par jour et par personne, calibrés pour un niveau de prix mondial
 * moyen (ratio ≈ 1), en EUR — localisés ensuite par pays via l'indice de niveau des prix.
 * Le logement est un prix de CHAMBRE (pas par personne) : standard = hôtel 2-3 étoiles,
 * confort = hôtel 4 étoiles ou plus.
 */
const BASE_DAILY_RATES_EUR: Record<TravelStyle, { lodging: number; food: number }> = {
  economique: { lodging: 20, food: 15 },
  standard: { lodging: 70, food: 30 },
  confort: { lodging: 180, food: 60 },
};

/**
 * Indice de niveau des prix par pays (Banque mondiale, indicateur PA.NUS.PPPC.RF — ratio du
 * pouvoir d'achat local par rapport aux États-Unis, référence = 1), gratuit et sans clé. Sert
 * à localiser un tarif hébergement/nourriture par pays, sur le même principe que l'intégration
 * Open-Meteo pour le climat : une estimation indicative à partir d'un indice publié, pas un prix
 * réel ni temps réel. En cas d'échec (pays inconnu, service indisponible), retombe sur le tarif
 * de référence non ajusté (ratio 1) sans bloquer le calcul.
 */
export async function fetchPriceLevelRatio(countryCode: string): Promise<number | null> {
  if (priceLevelCache.has(countryCode)) return priceLevelCache.get(countryCode) ?? null;
  try {
    const res = await fetch(
      `https://api.worldbank.org/v2/country/${countryCode}/indicator/PA.NUS.PPPC.RF?format=json&mrnev=1`
    );
    if (!res.ok) throw new Error("Service Banque mondiale indisponible");
    const json = (await res.json()) as unknown;
    const rows = Array.isArray(json) ? (json[1] as { value: number | null }[] | undefined) : undefined;
    const value = rows?.[0]?.value;
    const ratio = typeof value === "number" && value > 0 ? value : null;
    priceLevelCache.set(countryCode, ratio);
    return ratio;
  } catch {
    priceLevelCache.set(countryCode, null);
    return null;
  }
}

/** Tarif hébergement/nuit (EUR) auto-estimé pour un pays et un style de voyage, avant tout
 * override manuel. */
export async function estimateLodgingRate(countryCode: string | null, style: TravelStyle): Promise<number> {
  const ratio = countryCode ? await fetchPriceLevelRatio(countryCode) : null;
  return BASE_DAILY_RATES_EUR[style].lodging * (ratio ?? 1);
}

/** Tarif nourriture/jour/personne (EUR) auto-estimé pour un pays et un style de voyage. */
export async function estimateFoodRate(countryCode: string | null, style: TravelStyle): Promise<number> {
  const ratio = countryCode ? await fetchPriceLevelRatio(countryCode) : null;
  return BASE_DAILY_RATES_EUR[style].food * (ratio ?? 1);
}

export type CityPlannedCosts = { transport: number; lodging: number; food: number };

/**
 * Estimation prévisionnelle (transport vers la ville suivante, logement, nourriture) pour UNE
 * ville précise — seule source d'estimation automatique de l'application (une ligne par ville,
 * voir le dialogue d'édition d'une ville et la vue d'ensemble du budget, qui pointent toutes les
 * deux vers les mêmes lignes `voyage_expenses`). Le pays affiché dans la vue d'ensemble est un
 * total calculé de ses villes, jamais une estimation concurrente.
 */
export async function estimateCityPlannedCosts(input: {
  nights: number;
  distanceKm: number | null;
  transportMode: string | null;
  countryCode: string | null;
  style: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
  lodgingOverride: number | null;
  foodOverride: number | null;
}): Promise<CityPlannedCosts> {
  const lodgingRate = input.lodgingOverride ?? (await estimateLodgingRate(input.countryCode, input.style));
  const foodRate = input.foodOverride ?? (await estimateFoodRate(input.countryCode, input.style));
  const rooms = Math.max(1, input.lodgingCount || 1);
  const travelers = Math.max(1, input.travelerCount || 1);
  return {
    transport: estimateTransportLegCost(input.distanceKm, input.transportMode, travelers),
    lodging: input.nights * rooms * lodgingRate,
    food: input.nights * travelers * foodRate,
  };
}
