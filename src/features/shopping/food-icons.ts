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
  { keywords: ["citron vert", "lime"], icon: "🍋", category: "Fruits et légumes" },
  { keywords: ["citron"], icon: "🍋", category: "Fruits et légumes" },
  { keywords: ["raisin"], icon: "🍇", category: "Fruits et légumes" },
  { keywords: ["fraise"], icon: "🍓", category: "Fruits et légumes" },
  { keywords: ["framboise", "myrtille", "mure", "groseille", "cassis", "fruits rouges"], icon: "🫐", category: "Fruits et légumes" },
  { keywords: ["peche", "nectarine", "abricot"], icon: "🍑", category: "Fruits et légumes" },
  { keywords: ["poire"], icon: "🍐", category: "Fruits et légumes" },
  { keywords: ["ananas"], icon: "🍍", category: "Fruits et légumes" },
  { keywords: ["pasteque"], icon: "🍉", category: "Fruits et légumes" },
  { keywords: ["melon"], icon: "🍈", category: "Fruits et légumes" },
  { keywords: ["mangue"], icon: "🥭", category: "Fruits et légumes" },
  { keywords: ["kiwi"], icon: "🥝", category: "Fruits et légumes" },
  { keywords: ["avocat"], icon: "🥑", category: "Fruits et légumes" },
  { keywords: ["cerise"], icon: "🍒", category: "Fruits et légumes" },
  { keywords: ["fruit de la passion", "grenade", "figue", "datte", "litchi", "kaki"], icon: "🍈", category: "Fruits et légumes" },
  { keywords: ["carotte"], icon: "🥕", category: "Fruits et légumes" },
  { keywords: ["pomme de terre", "patate douce", "patate"], icon: "🥔", category: "Fruits et légumes" },
  { keywords: ["tomate"], icon: "🍅", category: "Fruits et légumes" },
  { keywords: ["salade", "laitue", "roquette", "mesclun", "endive"], icon: "🥬", category: "Fruits et légumes" },
  { keywords: ["epinard", "blette"], icon: "🥬", category: "Fruits et légumes" },
  { keywords: ["chou-fleur", "chou fleur"], icon: "🥦", category: "Fruits et légumes" },
  { keywords: ["chou"], icon: "🥬", category: "Fruits et légumes" },
  { keywords: ["brocoli"], icon: "🥦", category: "Fruits et légumes" },
  { keywords: ["poivron"], icon: "🫑", category: "Fruits et légumes" },
  { keywords: ["concombre", "cornichon"], icon: "🥒", category: "Fruits et légumes" },
  { keywords: ["courgette"], icon: "🥒", category: "Fruits et légumes" },
  { keywords: ["courge", "potiron", "citrouille", "butternut"], icon: "🎃", category: "Fruits et légumes" },
  { keywords: ["champignon"], icon: "🍄", category: "Fruits et légumes" },
  { keywords: ["oignon", "echalote"], icon: "🧅", category: "Fruits et légumes" },
  { keywords: ["ail"], icon: "🧄", category: "Fruits et légumes" },
  { keywords: ["gingembre"], icon: "🫚", category: "Fruits et légumes" },
  { keywords: ["maïs", "mais"], icon: "🌽", category: "Fruits et légumes" },
  { keywords: ["aubergine"], icon: "🍆", category: "Fruits et légumes" },
  { keywords: ["piment"], icon: "🌶️", category: "Fruits et légumes" },
  { keywords: ["asperge"], icon: "🥬", category: "Fruits et légumes" },
  { keywords: ["artichaut"], icon: "🥬", category: "Fruits et légumes" },
  { keywords: ["radis", "navet", "betterave", "celeri", "panais", "fenouil"], icon: "🥕", category: "Fruits et légumes" },
  { keywords: ["haricot vert", "haricot"], icon: "🫘", category: "Fruits et légumes" },
  { keywords: ["petit pois", "pois"], icon: "🫛", category: "Fruits et légumes" },
  { keywords: ["herbes", "persil", "basilic", "ciboulette", "coriandre", "menthe", "thym", "romarin"], icon: "🌿", category: "Fruits et légumes" },

  { keywords: ["poulet", "volaille", "dinde", "canard", "escalope"], icon: "🍗", category: "Viandes et poissons" },
  { keywords: ["boeuf", "steak", "viande hachee", "entrecote", "bavette", "cote de boeuf"], icon: "🥩", category: "Viandes et poissons" },
  { keywords: ["veau", "agneau", "gigot", "cotelette"], icon: "🍖", category: "Viandes et poissons" },
  { keywords: ["merguez", "chorizo"], icon: "🌭", category: "Viandes et poissons" },
  { keywords: ["porc", "jambon", "lardon", "bacon", "saucisse", "charcuterie", "pate", "rillette", "terrine", "foie gras"], icon: "🥓", category: "Viandes et poissons" },
  { keywords: ["poisson", "saumon", "thon", "cabillaud", "truite", "bar", "dorade", "colin", "merlu", "sole", "hareng", "maquereau", "sardine"], icon: "🐟", category: "Viandes et poissons" },
  { keywords: ["crevette", "gambas"], icon: "🍤", category: "Viandes et poissons" },
  { keywords: ["fruits de mer", "crustace", "moule", "huitre", "coquille saint-jacques", "calamar", "poulpe", "crabe", "homard", "langoustine"], icon: "🦐", category: "Viandes et poissons" },
  { keywords: ["tofu", "seitan", "steak vegetal", "proteine vegetale"], icon: "🧈", category: "Viandes et poissons" },

  { keywords: ["oeuf", "œuf"], icon: "🥚", category: "Produits laitiers et œufs" },
  { keywords: ["lait vegetal", "lait d'amande", "lait de soja", "lait d'avoine", "lait de coco"], icon: "🥛", category: "Produits laitiers et œufs" },
  { keywords: ["lait"], icon: "🥛", category: "Produits laitiers et œufs" },
  { keywords: ["mozzarella", "mozzarela", "burrata"], icon: "🧀", category: "Produits laitiers et œufs" },
  { keywords: ["camembert", "comte", "emmental", "chevre", "feta", "parmesan", "ricotta", "mascarpone", "cheddar", "gruyere", "brie", "roquefort", "reblochon", "raclette", "gouda", "cantal", "fromage rape", "fromage frais"], icon: "🧀", category: "Produits laitiers et œufs" },
  { keywords: ["fromage"], icon: "🧀", category: "Produits laitiers et œufs" },
  { keywords: ["yaourt", "yogourt", "yoghourt", "fromage blanc", "petit suisse", "skyr"], icon: "🥣", category: "Produits laitiers et œufs" },
  { keywords: ["creme fraiche", "creme liquide", "creme entiere", "creme"], icon: "🥛", category: "Produits laitiers et œufs" },
  { keywords: ["beurre", "margarine"], icon: "🧈", category: "Produits laitiers et œufs" },

  { keywords: ["pain", "baguette", "pain de mie", "pain complet", "pain de campagne"], icon: "🥖", category: "Boulangerie et pâtisserie" },
  { keywords: ["croissant", "viennoiserie", "pain au chocolat", "chausson aux pommes"], icon: "🥐", category: "Boulangerie et pâtisserie" },
  { keywords: ["brioche"], icon: "🥯", category: "Boulangerie et pâtisserie" },
  { keywords: ["gaufre"], icon: "🧇", category: "Boulangerie et pâtisserie" },
  { keywords: ["crepe", "pancake"], icon: "🥞", category: "Boulangerie et pâtisserie" },
  { keywords: ["gateau", "patisserie", "tarte", "muffin", "cupcake", "eclair", "mille-feuille"], icon: "🍰", category: "Boulangerie et pâtisserie" },
  { keywords: ["biscuit", "cookie", "biscotte", "sable"], icon: "🍪", category: "Boulangerie et pâtisserie" },

  { keywords: ["riz"], icon: "🍚", category: "Épicerie salée" },
  { keywords: ["pate", "spaghetti", "nouille", "penne", "tagliatelle", "coquillette", "lasagne", "macaroni"], icon: "🍝", category: "Épicerie salée" },
  { keywords: ["farine", "levure", "chapelure"], icon: "🌾", category: "Épicerie salée" },
  { keywords: ["quinoa", "boulgour", "semoule", "polenta", "avoine"], icon: "🌾", category: "Épicerie salée" },
  { keywords: ["lentille", "pois chiche", "haricot rouge", "haricot blanc", "houmous"], icon: "🫘", category: "Épicerie salée" },
  { keywords: ["huile"], icon: "🫒", category: "Épicerie salée" },
  { keywords: ["vinaigre"], icon: "🍶", category: "Épicerie salée" },
  { keywords: ["moutarde", "mayonnaise", "ketchup", "sauce soja", "sauce", "condiment", "vinaigrette"], icon: "🍯", category: "Épicerie salée" },
  { keywords: ["bouillon", "cube de bouillon"], icon: "🥫", category: "Épicerie salée" },
  { keywords: ["sel", "poivre", "epice", "curry", "paprika", "cumin"], icon: "🧂", category: "Épicerie salée" },
  { keywords: ["soupe", "veloute", "potage"], icon: "🥫", category: "Épicerie salée" },
  { keywords: ["conserve", "boite de conserve"], icon: "🥫", category: "Épicerie salée" },
  { keywords: ["pizza"], icon: "🍕", category: "Épicerie salée" },
  { keywords: ["noix", "amande", "noisette", "cacahuete", "pistache", "fruits secs", "graine"], icon: "🥜", category: "Épicerie salée" },
  { keywords: ["chips", "biscuits aperitifs", "cacahuetes aperitif"], icon: "🍿", category: "Épicerie salée" },

  { keywords: ["sucre"], icon: "🧂", category: "Épicerie sucrée" },
  { keywords: ["miel"], icon: "🍯", category: "Épicerie sucrée" },
  { keywords: ["chocolat", "cacao", "pate a tartiner", "nutella"], icon: "🍫", category: "Épicerie sucrée" },
  { keywords: ["confiture", "compote", "marmelade"], icon: "🍯", category: "Épicerie sucrée" },
  { keywords: ["cereale", "muesli", "granola", "flocons d'avoine"], icon: "🥣", category: "Épicerie sucrée" },
  { keywords: ["bonbon", "chewing-gum", "sucette"], icon: "🍬", category: "Épicerie sucrée" },
  { keywords: ["pop-corn", "popcorn"], icon: "🍿", category: "Épicerie sucrée" },

  { keywords: ["eau"], icon: "💧", category: "Boissons" },
  { keywords: ["jus", "smoothie"], icon: "🧃", category: "Boissons" },
  { keywords: ["cafe"], icon: "☕", category: "Boissons" },
  { keywords: ["the", "infusion", "tisane"], icon: "🍵", category: "Boissons" },
  { keywords: ["soda", "cola", "limonade"], icon: "🥤", category: "Boissons" },
  { keywords: ["sirop", "boisson energisante", "kombucha"], icon: "🧃", category: "Boissons" },

  { keywords: ["vin"], icon: "🍷", category: "Alcool" },
  { keywords: ["biere"], icon: "🍺", category: "Alcool" },
  { keywords: ["champagne", "cremant", "prosecco"], icon: "🍾", category: "Alcool" },
  { keywords: ["whisky", "rhum", "vodka", "gin", "cognac", "liqueur", "apero", "pastis", "alcool"], icon: "🥃", category: "Alcool" },

  { keywords: ["glace", "sorbet", "surgele", "surgelee"], icon: "🍦", category: "Surgelés" },
  { keywords: ["frites surgelees", "legumes surgeles", "plat surgele", "poisson pane"], icon: "🧊", category: "Surgelés" },

  { keywords: ["lessive", "liquide vaisselle", "eponge", "nettoyant", "menage", "javel", "desinfectant", "assouplissant", "lingette"], icon: "🧼", category: "Hygiène et entretien" },
  { keywords: ["papier toilette", "essuie-tout", "mouchoir"], icon: "🧻", category: "Hygiène et entretien" },
  { keywords: ["papier aluminium", "aluminium", "papier cuisson", "papier sulfurise", "film alimentaire", "film etirable", "sac congelation", "sac de congelation"], icon: "🧻", category: "Hygiène et entretien" },
  { keywords: ["dentifrice", "brosse a dent", "fil dentaire"], icon: "🪥", category: "Hygiène et entretien" },
  { keywords: ["savon", "shampoing", "gel douche", "deodorant", "rasoir"], icon: "🧴", category: "Hygiène et entretien" },
  { keywords: ["pile"], icon: "🔋", category: "Hygiène et entretien" },
  { keywords: ["sac poubelle"], icon: "🗑️", category: "Hygiène et entretien" },
  { keywords: ["ampoule", "bougie", "allumette", "briquet", "filtre a cafe"], icon: "🕯️", category: "Hygiène et entretien" },

  { keywords: ["couche", "lait infantile", "petit pot", "lingette bebe"], icon: "🍼", category: "Bébé et animaux" },
  { keywords: ["croquette", "litiere", "chat", "chien", "laisse", "friandise pour animaux", "sac a dejections"], icon: "🐾", category: "Bébé et animaux" },
];

const DEFAULT_ICON = "🛒";

function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Un mot-cl\u00e9 ne matche que sur une fronti\u00e8re de mot (espace/tiret/d\u00e9but-fin de cha\u00eene) \u2014 sans \u00e7a
 * un mot-cl\u00e9 court comme "lime" matchait n'importe quel nom contenant "alimentaire", "ail"
 * matchait "d\u00e9tail", etc. */
function matchesKeyword(normalizedName: string, keyword: string): boolean {
  const kw = normalize(keyword).trim();
  if (!kw) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(kw)}(?:[^a-z0-9]|$)`).test(normalizedName);
}

function matchRule(name: string) {
  const normalized = normalize(name);
  return RULES.find((rule) => rule.keywords.some((k) => matchesKeyword(normalized, k)));
}

export function suggestFoodIcon(name: string): string {
  return matchRule(name)?.icon ?? DEFAULT_ICON;
}

export function suggestFoodCategory(name: string): FoodCategory {
  return matchRule(name)?.category ?? DEFAULT_CATEGORY;
}
