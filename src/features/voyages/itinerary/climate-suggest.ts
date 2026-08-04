import type { ClimateRating } from "@/types/database";

type OpenMeteoArchiveResponse = {
  daily?: {
    time: string[];
    temperature_2m_mean: (number | null)[];
    precipitation_sum: (number | null)[];
  };
};

/** Fenêtre historique utilisée pour estimer un climat "typique" (5 ans, jusqu'à hier :
 * l'API archive d'Open-Meteo n'a pas encore les tout derniers jours). */
function historicalRange(): { start: string; end: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 6);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Estime un climat mensuel (favorable/moyen/déconseillé) à partir de l'historique météo
 * réel (Open-Meteo, gratuit, sans clé) sur les coordonnées GPS données. Simple heuristique
 * température moyenne + précipitations moyennes par mois, pas une prévision — un point de
 * départ que l'utilisateur peut ensuite ajuster manuellement.
 */
export async function estimateClimateByMonth(lat: number, lon: number): Promise<ClimateRating[]> {
  const { start, end } = historicalRange();
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "UTC",
  });
  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
  if (!res.ok) throw new Error("Service climatique indisponible");
  const data = (await res.json()) as OpenMeteoArchiveResponse;
  const daily = data.daily;
  if (!daily) throw new Error("Aucune donnée climatique pour ces coordonnées");

  const tempsByMonth: number[][] = Array.from({ length: 12 }, () => []);
  const precipByMonth: number[][] = Array.from({ length: 12 }, () => []);
  daily.time.forEach((dateStr, i) => {
    const month = Number(dateStr.slice(5, 7)) - 1;
    const temp = daily.temperature_2m_mean[i];
    const precip = daily.precipitation_sum[i];
    if (temp != null) tempsByMonth[month].push(temp);
    if (precip != null) precipByMonth[month].push(precip);
  });

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return tempsByMonth.map((temps, i): ClimateRating => {
    const meanTemp = avg(temps);
    const meanPrecip = avg(precipByMonth[i]);
    if (meanTemp == null || meanPrecip == null) return "mid";
    if (meanTemp < 5 || meanTemp > 35 || meanPrecip > 8) return "bad";
    if (meanTemp >= 18 && meanTemp <= 29 && meanPrecip < 3) return "good";
    return "mid";
  });
}
