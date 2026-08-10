/** Suggestion automatique d'une icône (emoji) pour un article de liste de courses, à partir de
 * mots-clés dans son nom — reste une suggestion : l'utilisateur peut toujours la changer via le
 * sélecteur d'emoji existant. Recherche insensible aux accents/majuscules, premier mot-clé
 * trouvé dans le nom qui gagne. */

const RULES: { keywords: string[]; icon: string }[] = [
  { keywords: ["pomme"], icon: "🍎" },
  { keywords: ["banane"], icon: "🍌" },
  { keywords: ["orange", "clementine", "mandarine"], icon: "🍊" },
  { keywords: ["citron"], icon: "🍋" },
  { keywords: ["raisin"], icon: "🍇" },
  { keywords: ["fraise"], icon: "🍓" },
  { keywords: ["peche", "nectarine", "abricot"], icon: "🍑" },
  { keywords: ["poire"], icon: "🍐" },
  { keywords: ["ananas"], icon: "🍍" },
  { keywords: ["pasteque"], icon: "🍉" },
  { keywords: ["melon"], icon: "🍈" },
  { keywords: ["mangue"], icon: "🥭" },
  { keywords: ["kiwi"], icon: "🥝" },
  { keywords: ["avocat"], icon: "🥑" },
  { keywords: ["cerise"], icon: "🍒" },

  { keywords: ["carotte"], icon: "🥕" },
  { keywords: ["pomme de terre", "patate"], icon: "🥔" },
  { keywords: ["tomate"], icon: "🍅" },
  { keywords: ["salade", "laitue"], icon: "🥬" },
  { keywords: ["brocoli"], icon: "🥦" },
  { keywords: ["poivron"], icon: "🫑" },
  { keywords: ["concombre"], icon: "🥒" },
  { keywords: ["champignon"], icon: "🍄" },
  { keywords: ["oignon", "echalote"], icon: "🧅" },
  { keywords: ["ail"], icon: "🧄" },
  { keywords: ["maïs", "mais"], icon: "🌽" },
  { keywords: ["aubergine"], icon: "🍆" },
  { keywords: ["piment"], icon: "🌶️" },

  { keywords: ["poulet", "volaille", "dinde", "canard"], icon: "🍗" },
  { keywords: ["boeuf", "steak", "viande hachee", "veau"], icon: "🥩" },
  { keywords: ["porc", "jambon", "lardon", "bacon", "saucisse", "charcuterie"], icon: "🥓" },
  { keywords: ["poisson", "saumon", "thon", "cabillaud", "truite"], icon: "🐟" },
  { keywords: ["crevette", "fruits de mer", "crustace"], icon: "🍤" },
  { keywords: ["oeuf", "œuf"], icon: "🥚" },

  { keywords: ["lait"], icon: "🥛" },
  { keywords: ["fromage"], icon: "🧀" },
  { keywords: ["yaourt", "yogourt"], icon: "🥣" },
  { keywords: ["beurre"], icon: "🧈" },

  { keywords: ["pain", "baguette"], icon: "🥖" },
  { keywords: ["croissant", "viennoiserie"], icon: "🥐" },
  { keywords: ["gateau", "patisserie"], icon: "🍰" },
  { keywords: ["biscuit", "cookie"], icon: "🍪" },
  { keywords: ["pizza"], icon: "🍕" },
  { keywords: ["cereale", "muesli"], icon: "🥣" },

  { keywords: ["riz"], icon: "🍚" },
  { keywords: ["pate", "spaghetti", "nouille"], icon: "🍝" },
  { keywords: ["farine"], icon: "🌾" },
  { keywords: ["huile"], icon: "🫒" },
  { keywords: ["sucre", "miel"], icon: "🍯" },
  { keywords: ["sel", "poivre", "epice"], icon: "🧂" },
  { keywords: ["chocolat"], icon: "🍫" },
  { keywords: ["confiture"], icon: "🍯" },
  { keywords: ["soupe"], icon: "🥫" },
  { keywords: ["conserve"], icon: "🥫" },

  { keywords: ["eau"], icon: "💧" },
  { keywords: ["jus"], icon: "🧃" },
  { keywords: ["vin"], icon: "🍷" },
  { keywords: ["biere"], icon: "🍺" },
  { keywords: ["cafe"], icon: "☕" },
  { keywords: ["the "], icon: "🍵" },
  { keywords: ["soda", "cola"], icon: "🥤" },

  { keywords: ["couche"], icon: "🍼" },
  { keywords: ["lessive", "liquide vaisselle", "eponge", "nettoyant", "menage"], icon: "🧼" },
  { keywords: ["papier toilette", "essuie-tout", "mouchoir"], icon: "🧻" },
  { keywords: ["dentifrice", "brosse a dent"], icon: "🪥" },
  { keywords: ["savon", "shampoing", "gel douche"], icon: "🧴" },
  { keywords: ["pile"], icon: "🔋" },
  { keywords: ["sac poubelle"], icon: "🗑️" },
  { keywords: ["croquette", "litiere", "chat", "chien"], icon: "🐾" },
];

const DEFAULT_ICON = "🛒";

function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function suggestFoodIcon(name: string): string {
  const normalized = normalize(name);
  for (const rule of RULES) {
    if (rule.keywords.some((k) => normalized.includes(normalize(k)))) return rule.icon;
  }
  return DEFAULT_ICON;
}
