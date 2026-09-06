import { parseDelimitedText, parseAmount } from "@/features/voyages/csv-import/csv-parse";
import { addDays } from "@/features/voyages/itinerary/itinerary-model";
import type { FlatRow } from "@/features/voyages/itinerary/itinerary-model";

/**
 * Export/import CSV de l'itinéraire complet d'un voyage — une ligne = une ville (sous-étape),
 * les champs du pays parent (visa, vaccins, permis) répétés sur chaque ville qui lui appartient
 * (vue "à plat" déjà choisie pour les autres vues de l'itinéraire, cf. itinerary-model.ts).
 * Ouvre et se réédite tel quel dans Excel/Numbers/Google Sheets (CSV standard, pas de binaire
 * .xlsx — cf. discussion avec l'utilisateur).
 */

const HEADERS = [
  "Pays / région",
  "Visa nécessaire",
  "Vaccins recommandés",
  "Permis international nécessaire",
  "Ville",
  "Date début",
  "Nuits",
  "Logement",
  "Activités prévues",
  "Transport vers l'étape suivante",
  "Durée trajet (h)",
  "Coût trajet",
  "Devise trajet",
  "Distance (km)",
  "Latitude",
  "Longitude",
  "Tarif logement/nuit (€)",
  "Tarif nourriture/jour (€)",
  "Tarif transport local/jour (€)",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function boolLabel(b: boolean): string {
  return b ? "Oui" : "Non";
}

function parseBool(raw: string | undefined): boolean {
  if (!raw) return false;
  return /^(oui|yes|true|1|x)$/i.test(raw.trim());
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function buildItineraryCsv(flat: FlatRow[]): string {
  const lines = [HEADERS.map(csvCell).join(",")];
  for (const row of flat) {
    const { etape, sousEtape } = row;
    lines.push(
      [
        csvCell(etape.country_region),
        csvCell(boolLabel(etape.visa_needed)),
        csvCell(etape.vaccines),
        csvCell(boolLabel(etape.intl_permit_needed)),
        csvCell(sousEtape.city),
        csvCell(sousEtape.start_date),
        csvCell(sousEtape.duration_days),
        csvCell(sousEtape.lodging),
        csvCell(sousEtape.activities),
        csvCell(sousEtape.transport_next_mode),
        csvCell(sousEtape.transport_next_duration_hours),
        csvCell(sousEtape.transport_next_cost),
        csvCell(sousEtape.transport_next_currency),
        csvCell(sousEtape.distance_km),
        csvCell(sousEtape.latitude),
        csvCell(sousEtape.longitude),
        csvCell(sousEtape.lodging_cost_per_night),
        csvCell(sousEtape.food_cost_per_day),
        csvCell(sousEtape.local_transport_cost_per_day),
      ].join(",")
    );
  }
  // BOM UTF-8 : Excel (Windows en particulier) mal-interprète les accents d'un CSV sans BOM.
  return "﻿" + lines.join("\r\n");
}

export interface ImportCity {
  city: string;
  duration_days: number;
  lodging: string | null;
  activities: string | null;
  transport_next_mode: string | null;
  transport_next_duration_hours: number | null;
  transport_next_cost: number | null;
  transport_next_currency: string | null;
  distance_km: number | null;
  latitude: number | null;
  longitude: number | null;
  lodging_cost_per_night: number | null;
  food_cost_per_day: number | null;
  local_transport_cost_per_day: number | null;
}

export interface ImportCountry {
  country_region: string;
  visa_needed: boolean;
  vaccines: string | null;
  intl_permit_needed: boolean;
  cities: ImportCity[];
}

export interface ImportResult {
  countries: ImportCountry[];
  anchorStartDate: string | null;
  errors: string[];
  totalCities: number;
}

/**
 * Regroupe les lignes consécutives partageant le même pays (comparaison insensible à la casse et
 * aux espaces superflus) — l'ordre du fichier est préservé tel quel, pas de tri alphabétique :
 * l'itinéraire réel suit l'ordre du voyage (ex. Mexico → San Salvador → Lima), pas l'alphabet.
 * Les champs pays (visa/vaccins/permis) sont pris sur la première ligne du groupe.
 */
export function parseItineraryCsv(text: string): ImportResult {
  const grid = parseDelimitedText(text);
  const errors: string[] = [];
  if (grid.length === 0) {
    return { countries: [], anchorStartDate: null, errors: ["Fichier vide."], totalCities: 0 };
  }

  const headerRow = grid[0].map((h) => h.trim().toLowerCase());
  const indexOf = (label: string) => headerRow.indexOf(label.toLowerCase());
  const col = {
    country: indexOf("Pays / région"),
    visa: indexOf("Visa nécessaire"),
    vaccines: indexOf("Vaccins recommandés"),
    permit: indexOf("Permis international nécessaire"),
    city: indexOf("Ville"),
    startDate: indexOf("Date début"),
    nights: indexOf("Nuits"),
    lodging: indexOf("Logement"),
    activities: indexOf("Activités prévues"),
    transportMode: indexOf("Transport vers l'étape suivante"),
    transportHours: indexOf("Durée trajet (h)"),
    transportCost: indexOf("Coût trajet"),
    transportCurrency: indexOf("Devise trajet"),
    distance: indexOf("Distance (km)"),
    latitude: indexOf("Latitude"),
    longitude: indexOf("Longitude"),
    lodgingRate: indexOf("Tarif logement/nuit (€)"),
    foodRate: indexOf("Tarif nourriture/jour (€)"),
    localTransportRate: indexOf("Tarif transport local/jour (€)"),
  };

  if (col.country === -1 || col.city === -1) {
    return {
      countries: [],
      anchorStartDate: null,
      errors: ['Colonnes obligatoires introuvables : "Pays / région" et "Ville".'],
      totalCities: 0,
    };
  }

  const countries: ImportCountry[] = [];
  let anchorStartDate: string | null = null;
  let totalCities = 0;

  for (let i = 1; i < grid.length; i++) {
    const raw = grid[i];
    const lineNo = i + 1;
    const countryName = raw[col.country]?.trim();
    const cityName = raw[col.city]?.trim();
    if (!countryName && !cityName) continue;
    if (!countryName) {
      errors.push(`Ligne ${lineNo} : pays manquant, ligne ignorée.`);
      continue;
    }
    if (!cityName) {
      errors.push(`Ligne ${lineNo} : ville manquante, ligne ignorée.`);
      continue;
    }

    const last = countries[countries.length - 1];
    const sameCountry = last && last.country_region.trim().toLowerCase() === countryName.toLowerCase();
    const group: ImportCountry = sameCountry
      ? last
      : {
          country_region: countryName,
          visa_needed: col.visa !== -1 ? parseBool(raw[col.visa]) : false,
          vaccines: col.vaccines !== -1 ? raw[col.vaccines]?.trim() || null : null,
          intl_permit_needed: col.permit !== -1 ? parseBool(raw[col.permit]) : false,
          cities: [],
        };
    if (!sameCountry) countries.push(group);

    const nights = col.nights !== -1 ? parseNumber(raw[col.nights]) : null;
    if (col.startDate !== -1 && anchorStartDate === null) {
      const d = raw[col.startDate]?.trim();
      if (d) anchorStartDate = d;
    }

    group.cities.push({
      city: cityName,
      duration_days: nights && nights > 0 ? Math.round(nights) : 1,
      lodging: col.lodging !== -1 ? raw[col.lodging]?.trim() || null : null,
      activities: col.activities !== -1 ? raw[col.activities]?.trim() || null : null,
      transport_next_mode: col.transportMode !== -1 ? raw[col.transportMode]?.trim() || null : null,
      transport_next_duration_hours: col.transportHours !== -1 ? parseNumber(raw[col.transportHours]) : null,
      transport_next_cost: col.transportCost !== -1 ? parseAmount(raw[col.transportCost] ?? "") : null,
      transport_next_currency: col.transportCurrency !== -1 ? raw[col.transportCurrency]?.trim() || null : null,
      distance_km: col.distance !== -1 ? parseNumber(raw[col.distance]) : null,
      latitude: col.latitude !== -1 ? parseNumber(raw[col.latitude]) : null,
      longitude: col.longitude !== -1 ? parseNumber(raw[col.longitude]) : null,
      lodging_cost_per_night: col.lodgingRate !== -1 ? parseNumber(raw[col.lodgingRate]) : null,
      food_cost_per_day: col.foodRate !== -1 ? parseNumber(raw[col.foodRate]) : null,
      local_transport_cost_per_day: col.localTransportRate !== -1 ? parseNumber(raw[col.localTransportRate]) : null,
    });
    totalCities++;
  }

  if (countries.length === 0 && errors.length === 0) {
    errors.push("Aucune ligne exploitable trouvée.");
  }

  return { countries, anchorStartDate, errors, totalCities };
}

/**
 * Calcule les dates début/fin de chaque ville en cascade à partir de l'ancre (première date
 * renseignée) et du nombre de nuits de chacune — même principe que cascadeDatesFrom (voir
 * itinerary-model.ts), appliqué ici directement à l'import avant même le premier rendu de la
 * page (qui relancerait de toute façon cette même cascade automatiquement).
 */
export function computeImportDates(countries: ImportCountry[], anchorStartDate: string | null) {
  let cursor = anchorStartDate ?? new Date().toISOString().slice(0, 10);
  const dates: { start_date: string; end_date: string }[] = [];
  for (const country of countries) {
    for (const city of country.cities) {
      const start = cursor;
      const end = addDays(start, city.duration_days);
      dates.push({ start_date: start, end_date: end });
      cursor = end;
    }
  }
  return dates;
}
