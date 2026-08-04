import type { TravelStyle } from "@/types/database";

/** Cache en mémoire (par code pays ISO), pour éviter de répéter les appels pendant la session. */
const priceLevelCache = new Map<string, number | null>();

/**
 * Tarifs de référence par jour et par personne, calibrés pour un niveau de prix mondial
 * moyen (ratio ≈ 1), en EUR — localisés ensuite par pays via l'indice de niveau des prix.
 */
const BASE_DAILY_RATES_EUR: Record<TravelStyle, { lodging: number; food: number }> = {
  economique: { lodging: 12, food: 8 },
  standard: { lodging: 35, food: 18 },
  confort: { lodging: 90, food: 35 },
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

/** Estimation hébergement + nourriture, pays par pays (chaque pays de l'itinéraire pondéré par
 * son propre indice de niveau des prix et son nombre de nuits), sommée sur tout le voyage. */
export async function estimateLodgingAndFoodByCountry(
  countries: { countryCode: string | null; nights: number }[],
  style: TravelStyle,
  travelerCount: number,
  lodgingCount: number
): Promise<{ lodging: number; food: number }> {
  const rooms = Math.max(1, lodgingCount || 1);
  const travelers = Math.max(1, travelerCount || 1);
  const base = BASE_DAILY_RATES_EUR[style];
  let lodging = 0;
  let food = 0;
  for (const c of countries) {
    const ratio = c.countryCode ? await fetchPriceLevelRatio(c.countryCode) : null;
    const localFactor = ratio ?? 1;
    lodging += c.nights * rooms * base.lodging * localFactor;
    food += c.nights * travelers * base.food * localFactor;
  }
  return { lodging, food };
}
