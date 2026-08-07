export interface EmojiEntry {
  char: string;
  keywords: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  emojis: EmojiEntry[];
}

/** Bibliothèque d'emoji façon clavier iOS/Android, groupée par catégorie avec mots-clés en
 * français pour la recherche — tout est statique/embarqué, aucun appel réseau. */
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "voyages",
    label: "Voyages",
    emojis: [
      { char: "✈️", keywords: "avion vol aéroport voyage" },
      { char: "🧳", keywords: "valise bagage voyage" },
      { char: "🗺️", keywords: "carte plan itinéraire" },
      { char: "🧭", keywords: "boussole direction navigation" },
      { char: "🏝️", keywords: "île plage tropical vacances" },
      { char: "🏖️", keywords: "plage parasol vacances" },
      { char: "🏔️", keywords: "montagne neige sommet" },
      { char: "⛺", keywords: "tente camping" },
      { char: "🚗", keywords: "voiture route transport" },
      { char: "🚌", keywords: "bus transport" },
      { char: "🚆", keywords: "train rail transport" },
      { char: "🚢", keywords: "bateau navire croisière" },
      { char: "🛳️", keywords: "paquebot croisière bateau" },
      { char: "🚀", keywords: "fusée espace départ" },
      { char: "🛂", keywords: "passeport douane contrôle" },
      { char: "🎫", keywords: "billet ticket" },
      { char: "🧿", keywords: "porte-bonheur amulette" },
      { char: "🌍", keywords: "monde terre globe europe afrique" },
      { char: "🌎", keywords: "monde terre globe amérique" },
      { char: "🌏", keywords: "monde terre globe asie" },
      { char: "🚏", keywords: "arrêt bus transport" },
      { char: "🛶", keywords: "canoë kayak bateau" },
      { char: "🏕️", keywords: "camping tente nature" },
      { char: "🗽", keywords: "statue liberté monument" },
      { char: "🕌", keywords: "mosquée monument" },
    ],
  },
  {
    id: "activites",
    label: "Activités",
    emojis: [
      { char: "⚽", keywords: "football sport ballon" },
      { char: "🏀", keywords: "basket sport ballon" },
      { char: "🎾", keywords: "tennis sport" },
      { char: "🏄", keywords: "surf sport plage" },
      { char: "🚴", keywords: "vélo cyclisme sport" },
      { char: "🏃", keywords: "course running sport" },
      { char: "🧗", keywords: "escalade grimpe sport" },
      { char: "🏊", keywords: "natation piscine sport" },
      { char: "⛷️", keywords: "ski hiver sport" },
      { char: "🎣", keywords: "pêche loisir" },
      { char: "🎨", keywords: "art peinture créativité" },
      { char: "🎭", keywords: "théâtre spectacle" },
      { char: "🎬", keywords: "cinéma film" },
      { char: "🎮", keywords: "jeu vidéo manette" },
      { char: "🎸", keywords: "guitare musique" },
      { char: "🎧", keywords: "musique casque écoute" },
      { char: "📷", keywords: "photo appareil photographie" },
      { char: "📚", keywords: "livre lecture bibliothèque" },
      { char: "🧩", keywords: "puzzle jeu casse-tête" },
      { char: "🎲", keywords: "dé jeu société" },
      { char: "🧘", keywords: "yoga méditation détente" },
      { char: "🏆", keywords: "trophée victoire récompense" },
      { char: "🎯", keywords: "cible objectif précision" },
      { char: "🪁", keywords: "cerf-volant loisir" },
    ],
  },
  {
    id: "nature",
    label: "Nature",
    emojis: [
      { char: "☀️", keywords: "soleil beau temps" },
      { char: "🌤️", keywords: "nuage soleil temps" },
      { char: "🌧️", keywords: "pluie temps" },
      { char: "⛅", keywords: "nuage temps" },
      { char: "❄️", keywords: "neige flocon hiver" },
      { char: "🌈", keywords: "arc-en-ciel" },
      { char: "🌊", keywords: "vague mer océan" },
      { char: "🌳", keywords: "arbre nature forêt" },
      { char: "🌲", keywords: "sapin arbre nature" },
      { char: "🌵", keywords: "cactus désert" },
      { char: "🌸", keywords: "fleur cerisier printemps" },
      { char: "🌻", keywords: "tournesol fleur" },
      { char: "🍁", keywords: "feuille automne" },
      { char: "🦋", keywords: "papillon insecte" },
      { char: "🐬", keywords: "dauphin animal mer" },
      { char: "🐘", keywords: "éléphant animal safari" },
      { char: "🦁", keywords: "lion animal safari" },
      { char: "🐢", keywords: "tortue animal" },
      { char: "🌋", keywords: "volcan montagne" },
      { char: "🪐", keywords: "planète espace" },
      { char: "⭐", keywords: "étoile" },
      { char: "🌙", keywords: "lune nuit" },
    ],
  },
  {
    id: "nourriture",
    label: "Nourriture",
    emojis: [
      { char: "🍕", keywords: "pizza repas" },
      { char: "🍔", keywords: "burger repas" },
      { char: "🍜", keywords: "nouilles soupe repas" },
      { char: "🍣", keywords: "sushi japon repas" },
      { char: "🥗", keywords: "salade repas sain" },
      { char: "🍰", keywords: "gâteau dessert" },
      { char: "☕", keywords: "café boisson" },
      { char: "🍷", keywords: "vin boisson" },
      { char: "🍹", keywords: "cocktail boisson vacances" },
      { char: "🍺", keywords: "bière boisson" },
      { char: "🥐", keywords: "croissant petit-déjeuner" },
      { char: "🍎", keywords: "pomme fruit" },
      { char: "🍇", keywords: "raisin fruit" },
      { char: "🥑", keywords: "avocat fruit sain" },
      { char: "🍫", keywords: "chocolat" },
      { char: "🍦", keywords: "glace dessert" },
    ],
  },
  {
    id: "bureau",
    label: "Objets & bureau",
    emojis: [
      { char: "💼", keywords: "mallette travail bureau" },
      { char: "📁", keywords: "dossier fichier document" },
      { char: "📅", keywords: "calendrier date planning" },
      { char: "📌", keywords: "épingle punaise" },
      { char: "✏️", keywords: "crayon écriture note" },
      { char: "📝", keywords: "note mémo écriture" },
      { char: "📊", keywords: "graphique statistique" },
      { char: "📈", keywords: "graphique croissance progression" },
      { char: "🔧", keywords: "outil réparation bricolage" },
      { char: "🔨", keywords: "marteau outil bricolage" },
      { char: "🏠", keywords: "maison logement" },
      { char: "🏡", keywords: "maison jardin logement" },
      { char: "🏢", keywords: "immeuble bureau entreprise" },
      { char: "🛠️", keywords: "outils bricolage rénovation" },
      { char: "📦", keywords: "carton colis déménagement" },
      { char: "🔑", keywords: "clé accès sécurité" },
      { char: "💡", keywords: "idée ampoule inspiration" },
      { char: "🖥️", keywords: "ordinateur informatique" },
      { char: "📱", keywords: "téléphone mobile" },
      { char: "🧰", keywords: "boîte à outils bricolage" },
    ],
  },
  {
    id: "argent",
    label: "Argent & travail",
    emojis: [
      { char: "💰", keywords: "argent économie sac" },
      { char: "💶", keywords: "euro argent monnaie" },
      { char: "💳", keywords: "carte bancaire paiement" },
      { char: "🏦", keywords: "banque finance" },
      { char: "📉", keywords: "graphique baisse finance" },
      { char: "🧾", keywords: "facture reçu dépense" },
      { char: "🎯", keywords: "objectif cible" },
      { char: "🚀", keywords: "lancement croissance projet" },
      { char: "🏗️", keywords: "chantier construction rénovation" },
      { char: "⚖️", keywords: "balance juridique équilibre" },
      { char: "🎓", keywords: "diplôme études formation" },
      { char: "💍", keywords: "bague mariage fiançailles" },
      { char: "👶", keywords: "bébé naissance famille" },
      { char: "🐾", keywords: "animal patte compagnie" },
    ],
  },
  {
    id: "symboles",
    label: "Symboles",
    emojis: [
      { char: "❤️", keywords: "cœur amour" },
      { char: "⭐", keywords: "étoile favori" },
      { char: "✨", keywords: "étincelles magie" },
      { char: "🔥", keywords: "feu tendance" },
      { char: "✅", keywords: "coché validé terminé" },
      { char: "⚡", keywords: "éclair énergie rapide" },
      { char: "🎉", keywords: "fête confettis célébration" },
      { char: "🎁", keywords: "cadeau surprise" },
      { char: "🏁", keywords: "drapeau damier arrivée" },
      { char: "🔔", keywords: "cloche notification alerte" },
      { char: "🧭", keywords: "boussole direction" },
      { char: "🌟", keywords: "étoile brillante réussite" },
      { char: "💎", keywords: "diamant précieux" },
      { char: "🔒", keywords: "cadenas sécurité" },
      { char: "🆕", keywords: "nouveau" },
      { char: "🗂️", keywords: "classeur organisation" },
    ],
  },
  {
    id: "personnes",
    label: "Personnes",
    emojis: [
      { char: "🙂", keywords: "sourire content" },
      { char: "😄", keywords: "sourire heureux" },
      { char: "🥳", keywords: "fête célébration content" },
      { char: "🧑", keywords: "personne" },
      { char: "👩", keywords: "femme personne" },
      { char: "👨", keywords: "homme personne" },
      { char: "🧑‍🤝‍🧑", keywords: "amis groupe personnes" },
      { char: "👨‍👩‍👧‍👦", keywords: "famille" },
      { char: "🧑‍💻", keywords: "informaticien travail ordinateur" },
      { char: "🧑‍🍳", keywords: "cuisinier chef cuisine" },
      { char: "🧑‍🎨", keywords: "artiste créativité" },
      { char: "🧑‍⚕️", keywords: "médecin santé" },
      { char: "🧑‍🏫", keywords: "enseignant professeur" },
      { char: "🧑‍✈️", keywords: "pilote avion" },
    ],
  },
];

/** Cherche un emoji par mot-clé (ou par le caractère lui-même) dans toutes les catégories. */
export function searchEmojis(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const results: EmojiEntry[] = [];
  for (const category of EMOJI_CATEGORIES) {
    for (const entry of category.emojis) {
      if (seen.has(entry.char)) continue;
      if (entry.keywords.includes(q) || entry.char === q) {
        seen.add(entry.char);
        results.push(entry);
      }
    }
  }
  return results;
}
