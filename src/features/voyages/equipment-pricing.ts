import type { VoyageEquipment } from "@/types/database";

/** Tarif de base (EUR) par catégorie du catalogue, utilisé quand aucune règle plus précise ne
 * correspond au nom de l'article — largement affiné par les règles par mot-clé ci-dessous pour
 * les articles significatifs (électronique, bagagerie technique...), qui sinon fausseraient
 * fortement l'estimation (ex. un simple tarif "matériel électronique" ne peut pas représenter
 * à la fois un téléphone et une pile). */
const CATEGORY_BASE_PRICE_EUR: Record<string, number> = {
  Sacs: 35,
  Vêtements: 30,
  "Pour dormir": 30,
  "Matériel électronique": 25,
  Accessoires: 15,
  "Trousse de toilette": 6,
  "Trousse à pharmacie": 5,
  Papiers: 2,
  "Pour les enfants": 20,
};

/** Règles par mot-clé (insensibles à la casse, correspondance sur une sous-chaîne du nom de
 * l'article), vérifiées dans l'ordre : la première correspondance l'emporte. Couvre les
 * articles dont le prix réel s'écarte fortement du tarif de base de leur catégorie. */
const KEYWORD_PRICE_RULES: [string, number][] = [
  // Électronique — gros achats
  ["ordinateur portable", 700],
  ["ordinateur de plongée", 300],
  ["appareil photo", 350],
  ["objectif", 250],
  ["caméra", 250],
  ["drone", 550],
  ["tablette", 300],
  ["liseuse", 110],
  ["téléphone", 450],
  ["gps", 150],
  ["montre", 90],
  ["disque dur externe", 70],
  ["jumelles", 60],
  ["batterie externe", 30],
  ["mini-enceinte", 35],
  ["clé usb", 12],
  ["carte mémoire", 20],
  ["chargeur solaire", 45],
  ["boîtier étanche", 130],
  ["housse ordinateur", 25],
  ["housse appareil photo", 20],
  ["housse caméra", 20],
  ["étui tablette", 20],
  ["étui liseuse", 15],
  ["trépied", 25],
  ["adaptateur universel", 15],
  ["multiprise", 12],
  ["lecteur mp3", 30],
  ["cale-porte avec alarme", 15],
  // Bagagerie / camping — équipement technique
  ["sac à dos principal", 130],
  ["sac secondaire", 40],
  ["housse de transport", 30],
  ["sac étanche", 20],
  ["tente", 180],
  ["hamac", 40],
  ["tarp", 30],
  ["sursac", 40],
  ["sac de couchage", 90],
  ["matelas de sol", 40],
  ["réchaud", 50],
  ["cartouche de gaz", 6],
  ["popote", 25],
  // Vêtements techniques
  ["veste imperméable", 130],
  ["veste chaude", 110],
  ["doudoune", 130],
  ["cape/poncho de pluie", 20],
  ["polaire", 40],
  ["pantalon de randonnée", 60],
  // Chaussures
  ["chaussures de randonnée hautes", 140],
  ["chaussures de randonnée basses", 110],
  ["chaussures de trail", 90],
  ["baskets de running", 80],
  ["chaussures légères en toile", 40],
  ["chaussures d’eau", 25],
  ["bâtons de randonnée", 40],
  // Accessoires notables
  ["lunettes de soleil", 25],
  ["lunettes de vue", 150],
  ["couteau", 25],
  ["cadenas", 12],
  ["lampe frontale", 25],
  ["serviette microfibre", 15],
  ["gourde / paille filtrante", 30],
  ["gourde", 15],
  ["paire de jumelles", 60],
  ["parapluie", 15],
  ["instrument de musique", 150],
  ["douche portative", 20],
  // Enfants — gros équipement
  ["poussette", 150],
  ["porte-bébé", 80],
  ["lit de bébé tente", 60],
  ["lit parapluie", 70],
  ["babyphone", 60],
  ["siège auto", 150],
];

/** Estimation par défaut du prix unitaire (EUR) d'un article — mot-clé si connu, sinon le tarif
 * de base de sa catégorie. Reste une estimation indicative, toujours ajustable article par
 * article dans l'onglet Équipement. */
export function estimateEquipmentUnitPrice(name: string, category: string): number {
  const key = name.toLowerCase();
  for (const [keyword, price] of KEYWORD_PRICE_RULES) {
    if (key.includes(keyword)) return price;
  }
  return CATEGORY_BASE_PRICE_EUR[category] ?? 15;
}

/** Coût prévisionnel total du matériel (EUR) : uniquement les articles pas encore possédés
 * (ceux déjà chez soi n'ont pas de coût à prévoir), quantité × prix unitaire (ajusté ou estimé). */
export function computeEquipmentPlannedTotal(items: VoyageEquipment[]): number {
  return items
    .filter((e) => !e.owned)
    .reduce((sum, e) => sum + e.quantity * (e.unit_price ?? estimateEquipmentUnitPrice(e.name, e.category)), 0);
}
