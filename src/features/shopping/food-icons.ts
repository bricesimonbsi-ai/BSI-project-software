/** Suggestion automatique d'une icône et d'un rayon (catégorie) pour un article de liste de
 * courses, à partir de mots-clés dans son nom — reste une suggestion, l'icône peut toujours être
 * changée via le sélecteur d'emoji existant. Recherche insensible aux accents/majuscules, premier
 * mot-clé trouvé dans le nom qui gagne. */

export const FOOD_CATEGORIES = [
  "Fruits et légumes",
  "Viandes et poissons",
  "Produits laitiers et œufs",
  "Boulangerie et pâtisserie",
  "Épicerie salée",
  "Épicerie sucrée",
  "Boissons",
  "Alcool",
  "Surgelés",
  "Hygiène et entretien",
  "Bébé et animaux",
  "Autre",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

const DEFAULT_CATEGORY: FoodCategory = "Autre";

const RULES: { keywords: string[]; icon: string; category: FoodCategory }[] = [
  { keywords: ["pomme"], icon: "🍎", category: "Fruits et légumes" },
  { keywords: ["banane"], icon: "🍌", category: "Fruits et légumes" },
  { keywords: ["orange", "clementine", "mandarine"], icon: "🍊", category: "Fruits et légumes" },
  { keywords: ["citron"], icon: "🍋", category: "Fruits et légumes" },
  { keywords: ["raisin"], icon: "🍇", category: "Fruits et légumes" },
  { keywords: ["fraise"], icon: "🍓", category: "Fruits et légumes" },
  { keywords: ["peche", "nectarine", "abricot"], icon: "🍑", category: "Fruits et légumes" },
  { keywords: ["poire"], icon: "🍐", category: "Fruits et légumes" },
  { keywords: ["ananas"], icon: "🍍", category: "Fruits et légumes" },
  { keywords: ["pasteque"], icon: "🍉", category: "Fruits et légumes" },
  { keywords: ["melon"], icon: "🍈", category: "Fruits et légumes" },
  { keywords: ["mangue"], icon: "🥭", category: "Fruits et légumes" },
  { keywords: ["kiwi"], icon: "🥝", category: "Fruits et légumes" },
  { keywords: ["avocat"], icon: "🥑", category: "Fruits et légumes" },
  { keywords: ["cerise"], icon: "🍒", category: "Fruits et légumes" },
  { keywords: ["carotte"], icon: "🥕", category: "Fruits et légumes" },
  { keywords: ["pomme de terre", "patate"], icon: "🥔", category: "Fruits et légumes" },
  { keywords: ["tomate"], icon: "🍅", category: "Fruits et légumes" },
  { keywords: ["salade", "laitue"], icon: "🥬", category: "Fruits et légumes" },
  { keywords: ["brocoli"], icon: "🥦", category: "Fruits et légumes" },
  { keywords: ["poivron"], icon: "🫑", category: "Fruits et légumes" },
  { keywords: ["concombre"], icon: "🥒", category: "Fruits et légumes" },
  { keywords: ["champignon"], icon: "🍄", category: "Fruits et légumes" },
  { keywords: ["oignon", "echalote"], icon: "🧅", category: "Fruits et légumes" },
  { keywords: ["ail"], icon: "🧄", category: "Fruits et légumes" },
  { keywords: ["maïs", "mais"], icon: "🌽", category: "Fruits et légumes" },
  { keywords: ["aubergine"], icon: "🍆", category: "Fruits et légumes" },
  { keywords: ["piment"], icon: "🌶️", category: "Fruits et légumes" },

  { keywords: ["poulet", "volaille", "dinde", "canard"], icon: "🍗", category: "Viandes et poissons" },
  { keywords: ["boeuf", "steak", "viande hachee", "veau"], icon: "🥩", category: "Viandes et poissons" },
  { keywords: ["porc", "jambon", "lardon", "bacon", "saucisse", "charcuterie"], icon: "🥓", category: "Viandes et poissons" },
  { keywords: ["poisson", "saumon", "thon", "cabillaud", "truite"], icon: "🐟", category: "Viandes et poissons" },
  { keywords: ["crevette", "fruits de mer", "crustace"], icon: "🍤", category: "Viandes et poissons" },

  { keywords: ["oeuf", "œuf"], icon: "🥚", category: "Produits laitiers et œufs" },
  { keywords: ["lait"], icon: "🥛", category: "Produits laitiers et œufs" },
  { keywords: ["fromage"], icon: "🧀", category: "Produits laitiers et œufs" },
  { keywords: ["yaourt", "yogourt"], icon: "🥣", category: "Produits laitiers et œufs" },
  { keywords: ["beurre"], icon: "🧈", category: "Produits laitiers et œufs" },

  { keywords: ["pain", "baguette"], icon: "🥖", category: "Boulangerie et pâtisserie" },
  { keywords: ["croissant", "viennoiserie"], icon: "🥐", category: "Boulangerie et pâtisserie" },
  { keywords: ["gateau", "patisserie"], icon: "🍰", category: "Boulangerie et pâtisserie" },
  { keywords: ["biscuit", "cookie"], icon: "🍪", category: "Boulangerie et pâtisserie" },

  { keywords: ["riz"], icon: "🍚", category: "Épicerie salée" },
  { keywords: ["pate", "spaghetti", "nouille"], icon: "🍝", category: "Épicerie salée" },
  { keywords: ["farine"], icon: "🌾", category: "Épicerie salée" },
  { keywords: ["huile"], icon: "🫒", category: "Épicerie salée" },
  { keywords: ["sel", "poivre", "epice"], icon: "🧂", category: "Épicerie salée" },
  { keywords: ["soupe"], icon: "🥫", category: "Épicerie salée" },
  { keywords: ["conserve"], icon: "🥫", category: "Épicerie salée" },
  { keywords: ["pizza"], icon: "🍕", category: "Épicerie salée" },

  { keywords: ["sucre", "miel"], icon: "🍯", category: "Épicerie sucrée" },
  { keywords: ["chocolat"], icon: "🍫", category: "Épicerie sucrée" },
  { keywords: ["confiture"], icon: "🍯", category: "Épicerie sucrée" },
  { keywords: ["cereale", "muesli"], icon: "🥣", category: "Épicerie sucrée" },

  { keywords: ["eau"], icon: "💧", category: "Boissons" },
  { keywords: ["jus"], icon: "🧃", category: "Boissons" },
  { keywords: ["cafe"], icon: "☕", category: "Boissons" },
  { keywords: ["the "], icon: "🍵", category: "Boissons" },
  { keywords: ["soda", "cola"], icon: "🥤", category: "Boissons" },

  { keywords: ["vin"], icon: "🍷", category: "Alcool" },
  { keywords: ["biere"], icon: "🍺", category: "Alcool" },
  { keywords: ["champagne"], icon: "🍾", category: "Alcool" },
  { keywords: ["whisky", "rhum", "vodka", "gin", "alcool"], icon: "🥃", category: "Alcool" },

  { keywords: ["glace", "surgele", "surgelee"], icon: "🍦", category: "Surgelés" },

  { keywords: ["lessive", "liquide vaisselle", "eponge", "nettoyant", "menage"], icon: "🧼", category: "Hygiène et entretien" },
  { keywords: ["papier toilette", "essuie-tout", "mouchoir"], icon: "🧻", category: "Hygiène et entretien" },
  { keywords: ["dentifrice", "brosse a dent"], icon: "🪥", category: "Hygiène et entretien" },
  { keywords: ["savon", "shampoing", "gel douche"], icon: "🧴", category: "Hygiène et entretien" },
  { keywords: ["pile"], icon: "🔋", category: "Hygiène et entretien" },
  { keywords: ["sac poubelle"], icon: "🗑️", category: "Hygiène et entretien" },

  { keywords: ["couche"], icon: "🍼", category: "Bébé et animaux" },
  { keywords: ["croquette", "litiere", "chat", "chien"], icon: "🐾", category: "Bébé et animaux" },
];

const DEFAULT_ICON = "🛒";

function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchRule(name: string) {
  const normalized = normalize(name);
  return RULES.find((rule) => rule.keywords.some((k) => normalized.includes(normalize(k))));
}

export function suggestFoodIcon(name: string): string {
  return matchRule(name)?.icon ?? DEFAULT_ICON;
}

export function suggestFoodCategory(name: string): FoodCategory {
  return matchRule(name)?.category ?? DEFAULT_CATEGORY;
}
