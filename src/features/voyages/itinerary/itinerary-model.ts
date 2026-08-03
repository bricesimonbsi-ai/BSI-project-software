import type { VoyageEtape, VoyageSousEtape } from "@/types/database";

export type FlatRow = {
  etape: VoyageEtape;
  sousEtape: VoyageSousEtape;
  globalIndex: number;
  /** Distance/transport pour arriver à cette ville, hérités du sous_etape précédent dans l'ordre global. */
  incomingDistanceKm: number | null;
  incomingMode: string | null;
  incomingCost: number | null;
  incomingCostCurrency: string | null;
};

export type CountryGroup = {
  etape: VoyageEtape;
  rows: FlatRow[];
  totalKm: number;
  totalNights: number;
  stepRangeLabel: string;
};

/** Construit la liste plate des villes dans l'ordre global (pays puis villes), avec la distance entrante héritée. */
export function buildFlatRows(etapes: VoyageEtape[], sousEtapesByEtape: Map<string, VoyageSousEtape[]>): FlatRow[] {
  const sortedEtapes = [...etapes].sort((a, b) => a.order_index - b.order_index);
  const flat: FlatRow[] = [];

  let prevDistance: number | null = null;
  let prevMode: string | null = null;
  let prevCost: number | null = null;
  let prevCostCurrency: string | null = null;
  let globalIndex = 0;

  for (const etape of sortedEtapes) {
    const sousEtapes = [...(sousEtapesByEtape.get(etape.id) ?? [])].sort((a, b) => a.order_index - b.order_index);
    for (const sousEtape of sousEtapes) {
      globalIndex += 1;
      flat.push({
        etape,
        sousEtape,
        globalIndex,
        incomingDistanceKm: prevDistance,
        incomingMode: prevMode,
        incomingCost: prevCost,
        incomingCostCurrency: prevCostCurrency,
      });
      prevDistance = sousEtape.distance_km;
      prevMode = sousEtape.transport_next_mode;
      prevCost = sousEtape.transport_next_cost;
      prevCostCurrency = sousEtape.transport_next_currency;
    }
  }

  return flat;
}

export function groupByCountry(flat: FlatRow[]): CountryGroup[] {
  const groups: CountryGroup[] = [];
  let current: CountryGroup | null = null;

  for (const row of flat) {
    if (!current || current.etape.id !== row.etape.id) {
      current = { etape: row.etape, rows: [], totalKm: 0, totalNights: 0, stepRangeLabel: "" };
      groups.push(current);
    }
    current.rows.push(row);
    current.totalKm += row.incomingDistanceKm ?? 0;
    current.totalNights += row.sousEtape.duration_days ?? 0;
  }

  for (const group of groups) {
    const indices = group.rows.map((r) => r.globalIndex);
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    group.stepRangeLabel = min === max ? String(min) : `${min}–${max}`;
  }

  return groups;
}

/** Facteurs d'émission indicatifs (kg CO2 / km / personne), sans appel à une API externe. */
const EMISSION_FACTOR_BY_MODE: Record<string, number> = {
  avion: 0.18,
  train: 0.03,
  bus: 0.08,
  voiture: 0.12,
  ferry: 0.25,
  bateau: 0.25,
};

export function guessEmissionFactor(mode: string | null): number {
  if (!mode) return 0.1;
  const key = mode.toLowerCase();
  for (const [modeKey, factor] of Object.entries(EMISSION_FACTOR_BY_MODE)) {
    if (key.includes(modeKey)) return factor;
  }
  return 0.1;
}

export function estimateCo2Kg(distanceKm: number | null, mode: string | null): number {
  if (!distanceKm) return 0;
  return Math.round(distanceKm * guessEmissionFactor(mode));
}

export const CLIMATE_COLOR_CLASS: Record<string, string> = {
  good: "bg-emerald-500/25 dark:bg-emerald-400/25",
  mid: "bg-amber-500/25 dark:bg-amber-400/25",
  bad: "bg-rose-500/25 dark:bg-rose-400/25",
};

export const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Options de mode de transport, partagées entre les dialogues de saisie et l'affichage du tableau. */
export const TRANSPORT_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "avion", label: "Avion" },
  { value: "train", label: "Train" },
  { value: "bus", label: "Bus" },
  { value: "voiture", label: "Voiture" },
  { value: "ferry", label: "Ferry / bateau" },
  { value: "autre", label: "Autre" },
];

/** Rayon moyen de la Terre (km) pour la formule de Haversine. */
const EARTH_RADIUS_KM = 6371;

/** Distance à vol d'oiseau (km) entre deux points GPS, formule de Haversine (sans API externe). */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

/** Parse une date "YYYY-MM-DD" comme un jour calendaire UTC pur, sans effet de fuseau horaire local. */
function parseCalendarDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Mois (0=janvier..11=décembre) réellement couverts par la période planifiée d'une étape. */
export function getPlannedMonthIndices(arrivalDate: string | null, durationDays: number | null): Set<number> {
  const indices = new Set<number>();
  if (!arrivalDate) return indices;
  const start = parseCalendarDateUTC(arrivalDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(0, durationDays ?? 0));

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let guard = 0;
  while (cursor <= end && guard < 36) {
    indices.add(cursor.getUTCMonth());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard++;
  }
  return indices;
}

/** Additionne des jours calendaires à une date "YYYY-MM-DD", en arithmétique UTC pure (aucun effet de fuseau horaire). */
function addDays(dateStr: string, days: number): string {
  const d = parseCalendarDateUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Recalcule en cascade les dates de toutes les sous-étapes à partir de celle modifiée
 * (incluse), en préservant le nombre de nuits de chacune des suivantes : la date de
 * début de l'étape N = date de fin de l'étape N-1.
 */
export function cascadeDatesFrom(
  flat: FlatRow[],
  changedSousEtapeId: string,
  overrides: { start_date?: string; duration_days?: number }
): Array<{ id: string; start_date: string; end_date: string; duration_days: number }> {
  const changedIndex = flat.findIndex((r) => r.sousEtape.id === changedSousEtapeId);
  if (changedIndex === -1) return [];

  const updates: Array<{ id: string; start_date: string; end_date: string; duration_days: number }> = [];
  let nextStart: string | null = null;

  for (let i = changedIndex; i < flat.length; i++) {
    const row = flat[i].sousEtape;
    const isChanged = i === changedIndex;
    const start = isChanged ? overrides.start_date ?? row.start_date ?? "" : nextStart ?? row.start_date ?? "";
    const duration = isChanged ? overrides.duration_days ?? row.duration_days ?? 0 : row.duration_days ?? 0;
    if (!start) break;
    const end = addDays(start, duration);
    updates.push({ id: row.id, start_date: start, end_date: end, duration_days: duration });
    nextStart = end;
  }

  return updates;
}
