/** Client Google Places (New) côté navigateur — recherche par texte, suggestions à proximité
 * (géolocalisation du visiteur) et photos, pour alimenter automatiquement "où" un bar/restaurant
 * est situé (adresse, note, horaires, téléphone, site, prix). La clé est injectée au build via une
 * variable d'environnement (jamais codée en dur ni committée) : VITE_GOOGLE_PLACES_API_KEY, à
 * définir dans les variables d'environnement Vercel. Contrairement à TMDB/RAWG, Google Places
 * nécessite une clé avec facturation activée côté Google Cloud (quota gratuit mensuel, au-delà
 * facturé à l'usage) — restreins la clé par référent HTTP (domaine projeko.fr) côté Google Cloud. */

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
const BASE_URL = "https://places.googleapis.com/v1/places";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.priceLevel",
  "places.types",
  "places.photos",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.regularOpeningHours",
].join(",");

export function isGooglePlacesConfigured(): boolean {
  return !!API_KEY;
}

export type GooglePlaceResult = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  priceLevel?: string;
  types?: string[];
  photos?: { name: string }[];
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

const PRICE_LEVEL_SYMBOLS: Record<string, string> = {
  PRICE_LEVEL_FREE: "Gratuit",
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

export function priceLevelSymbol(priceLevel: string | undefined | null): string | null {
  return priceLevel ? (PRICE_LEVEL_SYMBOLS[priceLevel] ?? null) : null;
}

/** Tags de type lisibles (ex. "italian_restaurant" -> "Italian restaurant") — on retire les types
 * génériques peu informatifs ("restaurant", "food", "point_of_interest", "establishment"). */
export function readableTypes(types: string[] | undefined): string[] {
  const generic = new Set(["restaurant", "bar", "food", "point_of_interest", "establishment"]);
  return (types ?? [])
    .filter((t) => !generic.has(t))
    .map((t) => {
      const words = t.replace(/_/g, " ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    })
    .slice(0, 4);
}

export function placePhotoUrl(photoName: string | undefined, maxWidthPx = 400): string | null {
  if (!photoName || !API_KEY) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY}`;
}

async function placesPost(path: string, body: Record<string, unknown>): Promise<GooglePlaceResult[]> {
  if (!API_KEY) throw new Error("Clé API Google Places non configurée (VITE_GOOGLE_PLACES_API_KEY manquante).");
  const res = await fetch(`${BASE_URL}:${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Le message générique précédent ("Erreur lors de l'appel à Google Places") masquait la
    // vraie cause (clé absente/mal restreinte, API non activée, facturation...) — indispensable
    // pour diagnostiquer sans accès aux logs réseau du visiteur.
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? "";
    } catch {
      // réponse non-JSON : on garde juste le statut HTTP
    }
    throw new Error(`Erreur Google Places (HTTP ${res.status})${detail ? ` : ${detail}` : ""}`);
  }
  const data = await res.json();
  return (data.places ?? []) as GooglePlaceResult[];
}

export async function searchPlaces(query: string): Promise<GooglePlaceResult[]> {
  if (!query.trim()) return [];
  return placesPost("searchText", { textQuery: query, languageCode: "fr", maxResultCount: 8 });
}

/** Bars/restaurants à proximité d'un point (géolocalisation du visiteur), dans un rayon de 1.5 km —
 * alimente automatiquement l'onglet "Suggestions à proximité". */
export async function nearbyPlaces(latitude: number, longitude: number): Promise<GooglePlaceResult[]> {
  return placesPost("searchNearby", {
    includedTypes: ["restaurant", "bar", "cafe"],
    maxResultCount: 12,
    languageCode: "fr",
    locationRestriction: { circle: { center: { latitude, longitude }, radius: 1500 } },
  });
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
  });
}
