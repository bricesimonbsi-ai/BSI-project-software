import type { FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import type { VoyageSousEtape } from "@/types/database";

export type GuessedCategory = "logement" | "transport" | "nourriture" | "activites";

/** Mots-clés génériques (pas propres à une banque précise) reconnus dans la description d'une
 * ligne de relevé, pour pré-remplir une catégorie — toujours une SUGGESTION modifiable dans
 * l'aperçu d'import, jamais appliquée sans confirmation. */
const CATEGORY_KEYWORDS: Record<GuessedCategory, string[]> = {
  logement: ["airbnb", "booking", "hotel", "hôtel", "hostel", "auberge", "gite", "gîte"],
  transport: [
    "sncf",
    "air france",
    "easyjet",
    "ryanair",
    "transavia",
    "vueling",
    "wizz air",
    "uber",
    "taxi",
    "blablacar",
    "flixbus",
    "ouibus",
    "ratp",
    "metro",
    "métro",
    "aeroport",
    "aéroport",
    "rentalcars",
    "europcar",
    "hertz",
  ],
  nourriture: [
    "leclerc",
    "carrefour",
    "lidl",
    "super u",
    "intermarche",
    "intermarché",
    "monoprix",
    "auchan",
    "casino",
    "restaurant",
    "resto",
    "boulangerie",
    "brasserie",
    "mcdonald",
    "kfc",
    "burger",
    "pizzeria",
    "supermarche",
    "supermarché",
    "epicerie",
    "épicerie",
  ],
  activites: ["musee", "musée", "fnac", "billetterie", "ticket", "excursion", "spectacle"],
};

const WITHDRAWAL_KEYWORDS = ["retrait", "distributeur", "dab ", " dab", "gab ", " gab", "cash withdrawal", "atm "];

export function guessCategory(description: string): GuessedCategory | null {
  const d = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [GuessedCategory, string[]][]) {
    if (keywords.some((k) => d.includes(k))) return category;
  }
  return null;
}

export function isWithdrawal(description: string): boolean {
  const d = description.toLowerCase();
  return WITHDRAWAL_KEYWORDS.some((k) => d.includes(k));
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

function findContainingStay(flat: FlatRow[], date: string): VoyageSousEtape | null {
  const row = flat.find(
    (r) => r.sousEtape.start_date && r.sousEtape.end_date && date >= r.sousEtape.start_date && date <= r.sousEtape.end_date
  );
  return row?.sousEtape ?? null;
}

function findNextUpcomingStay(flat: FlatRow[], date: string): VoyageSousEtape | null {
  const row = flat.find((r) => r.sousEtape.start_date && r.sousEtape.start_date >= date);
  return row?.sousEtape ?? null;
}

function findNearestStay(flat: FlatRow[], date: string): VoyageSousEtape | null {
  let best: { sousEtape: VoyageSousEtape; distance: number } | null = null;
  for (const r of flat) {
    if (!r.sousEtape.start_date || !r.sousEtape.end_date) continue;
    const distance =
      date < r.sousEtape.start_date
        ? daysBetween(date, r.sousEtape.start_date)
        : date > r.sousEtape.end_date
          ? daysBetween(r.sousEtape.end_date, date)
          : 0;
    if (!best || distance < best.distance) best = { sousEtape: r.sousEtape, distance };
  }
  return best?.sousEtape ?? null;
}

/** Suggestion de ville pour une dépense importée : logement/transport sont souvent payés en
 * AVANCE (réservation avant le séjour) — une date de paiement ne suffit donc pas, on privilégie
 * le PROCHAIN séjour à venir. Nourriture/activités/retrait d'espèces sont des dépenses "sur le
 * moment" — on privilégie le séjour dont la période contient la date de paiement. Dans tous les
 * cas, ce n'est qu'une suggestion pré-remplie et modifiable dans l'aperçu, jamais appliquée sans
 * confirmation de l'utilisateur. */
export function guessCity(flat: FlatRow[], date: string | null, category: GuessedCategory | null): VoyageSousEtape | null {
  if (!date) return null;
  if (category === "logement" || category === "transport") {
    return findNextUpcomingStay(flat, date) ?? findContainingStay(flat, date) ?? findNearestStay(flat, date);
  }
  return findContainingStay(flat, date) ?? findNearestStay(flat, date);
}

export type CashSplitRatios = { transport_local: number; activites: number; nourriture: number };

export type CashSplitItem = { category: "transport" | "activites" | "nourriture"; subCategory?: string; label: string; amount: number };

/** Répartit un retrait d'espèces en 3 dépenses (transport sur place / activités / nourriture)
 * selon les % mémorisés sur le voyage (voir voyages.cash_split_ratios) — la somme des 3 montants
 * reste toujours EXACTEMENT égale au retrait, le dernier poste (nourriture) absorbant l'écart
 * d'arrondi pour ne jamais faire dériver le total importé. */
export function splitCashWithdrawal(amount: number, ratios: CashSplitRatios): CashSplitItem[] {
  const total = ratios.transport_local + ratios.activites + ratios.nourriture || 100;
  const transportAmount = Math.round(((amount * ratios.transport_local) / total) * 100) / 100;
  const activitesAmount = Math.round(((amount * ratios.activites) / total) * 100) / 100;
  const nourritureAmount = Math.round((amount - transportAmount - activitesAmount) * 100) / 100;
  return [
    { category: "transport", subCategory: "sur_place", label: "Transport sur place", amount: transportAmount },
    { category: "activites", label: "Activités", amount: activitesAmount },
    { category: "nourriture", label: "Nourriture", amount: nourritureAmount },
  ];
}
