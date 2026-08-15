import type { RestaurantType } from "@/types/database";

export const RESTAURANT_TYPE_LABELS: Record<RestaurantType, { singular: string; plural: string; icon: string }> = {
  bar: { singular: "Bar", plural: "Bars", icon: "🍸" },
  restaurant: { singular: "Restaurant", plural: "Restaurants", icon: "🍽️" },
};

/** Tags de style suggérés au classement d'un lieu (en plus de ceux déjà détectés automatiquement
 * via Google Places) — dépend du modèle du projet ; "restaurant" sert aussi de repli pour les
 * projets créés avant l'introduction des modèles (restaurant_type null). */
export const SUGGESTED_STYLE_TAGS: Record<RestaurantType, string[]> = {
  bar: ["Bar à cocktails", "Bar à vin", "Pub", "Rooftop", "Bar à bières", "Bar à tapas"],
  restaurant: [
    "Italien",
    "Asiatique",
    "Fast food",
    "Gastronomique",
    "Végétarien",
    "Fruits de mer",
    "Pizzeria",
    "Brasserie",
  ],
};

/** Types Google Places (New) inclus dans les suggestions "à proximité" selon le modèle du projet ;
 * mixte (défaut) pour les projets sans modèle défini (restaurant_type null). */
export const RESTAURANT_TYPE_PLACE_TYPES: Record<RestaurantType, string[]> = {
  bar: ["bar", "night_club"],
  restaurant: ["restaurant", "cafe", "bakery"],
};
