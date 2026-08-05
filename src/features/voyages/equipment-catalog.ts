// Catalogue de base du matériel de voyage (à cocher, quantité ajustable), issu du
// classeur Excel "Équipement" fourni par l'utilisateur (Tourdumondiste.com). Données
// statiques embarquées, sur le même principe que les pays/villes (voir location-pickers.ts).
export type EquipmentCatalogGroup = { category: string; items: string[] };

export const EQUIPMENT_CATALOG: EquipmentCatalogGroup[] = [
  {
    category: "Sacs",
    items: ["Sac à dos principal", "Sac secondaire", "Trousse de toilette", "Trousse à pharmacie", "Trousse de secours", "Housse de transport", "Sac étanche", "Housses de compression étanches", "Sac à laver le linge", "Sac pour appareil photo", "Filet pour le linge", "Packsafe"],
  },
  {
    category: "Vêtements",
    items: ["Casquette / chapeau", "Bonnet", "Foulard", "Cache col / écharpe", "Bandana", "Veste imperméable (hardshell)", "Veste chaude (softshell)", "Doudoune ultra-légère", "Cape/poncho de pluie", "Polaire", "Sweat-shirt", "Pull", "Gants", "T-shirts manches courtes en coton", "T-shirt manches courtes en synthétique", "T-shirt manches courtes en merinos", "T-shirt manches longues en coton", "T-shirt manches longues en synthétique", "T-shirt manches longues en merinos", "T-shirt anti-UV", "Polo", "Chemise", "Pyjama / chemise de nuit", "Brassières / soutien-gorge", "Robe", "Jupe", "Short", "Pantalon de randonnée convertible en short", "Pantalon de randonnée non convertible", "Jean / chino", "Maillot de bain", "Culottes / slips / tangas / strings / caleçons / boxers", "Collant / legging", "Bas / chaussettes de contention", "Chaussettes en coton", "Chaussettes de randonnée", "Tongs", "Chaussures de trail", "Chaussures légères en toile", "Sandales", "Baskets de running", "Chaussures d’eau", "Chaussures de randonnée basses", "Chaussures de randonnée hautes"],
  },
  {
    category: "Pour dormir",
    items: ["Drap de sac (sac à viande)", "Bouchons d'oreilles", "Sac de couchage", "Oreiller gonflable", "Masque de sommeil", "Matelas de sol", "Tente", "Hamac", "Tarp", "Couvertures de survie", "Sursac"],
  },
  {
    category: "Matériel électronique",
    items: ["Téléphone", "Chargeur téléphone", "Coque téléphone", "Écouteurs", "Mini-trépied photo smartphone", "Perche à selfie smartphone", "Pochette étanche smartphone", "Mini-objectif(s) photo smartphone", "Appareil photo", "Housse appareil photo", "Objectif appareil photo", "Chargeur appareil photo", "Batterie(s) de rechange appareil photo", "Objectif(s) appareil photo", "Kit de nettoyage appareil photo", "Filtre(s) appareil photo", "Chiffon optique", "Trépied appareil photo", "Boîtier étanche appareil photo", "Pellicule(s) appareil photo argentique", "Télécommande appareil photo", "Caméra", "Chargeur caméra", "Boîtier étanche caméra", "Housse caméra", "Batterie(s) de rechange caméra", "Accessoire(s) caméra", "Filtre(s) caméra", "Ordinateur portable", "Chargeur ordinateur", "Housse ordinateur", "Adaptateur universel", "Carte mémoire", "Clé USB", "Disque dur externe", "Multiprise USB", "Souris", "Tablette", "Chargeur tablette", "Étui tablette", "Lecteur de carte mémoire", "Clavier tablette", "Liseuse", "Étui liseuse", "Chargeur liseuse", "Batterie externe", "Multiprise électrique", "Mini-enceinte", "Piles", "Piles rechargeables", "Chargeur de piles", "Double prise jack", "Chargeur solaire", "Lecteur MP3/MP4", "GPS", "Diffuseur anti-moustiques", "Drone", "Cale-porte avec alarme"],
  },
  {
    category: "Accessoires",
    items: ["Lunettes de soleil", "Lunettes de vue + boitier", "Lentilles de contact + boitier + produit", "Stylo", "Carnet", "Lampe frontale / lampe torche", "Cadenas", "Couteau", "Briquet", "Zip-bags congélation", "Serviette microfibre", "Portefeuille / porte-monnaie / ceinture cache-billets", "Gourde / paille filtrante", "Gourde / bidon / camelbak", "Kit de couture", "Bijoux", "Petite bouteille d’eau", "Corde à linge", "Jeu de cartes/de société", "Mouchoirs", "Guide de voyage", "Pochette cache billets", "Montre", "Livre", "Paréo", "Clés de chez vous", "Mousquetons", "Moustiquaire", "Palmes", "Masque de snorkeling", "Tuba", "Boussole", "Réchaud", "Cartouche de gaz", "Popote", "Chaîne ou câble antivol", "Scotch", "Tupperware", "Bouche évier universel", "Sangles", "Paire de jumelles", "Mini-dictionnaire", "Tendeurs, élastiques", "Méthode de langue", "Pisse debout", "Dictionnaire pictogramme", "Instrument de musique", "Douche portative", "Réveil", "Ration de survie", "Parapluie", "Ordinateur de plongée", "Chaufferette", "Cintre", "Bâtons de randonnée"],
  },
  {
    category: "Trousse de toilette",
    items: ["Brosse à dents", "Dentifrice", "Crème solaire", "Pince à épilier", "Répulsif anti-moustiques", "Élastiques à cheveux", "Déodorant/pierre d’alun", "Coupe ongles", "Stick lèvres", "Savon solide", "Rasoir manuel", "Brosse à cheveux", "Cotons-tiges", "Tampons", "Shampoing liquide", "Crême hydratante", "Miroir de poche", "Papier toilette", "Mascara", "Peigne", "Lingettes", "Lime à ongles", "Préservatifs", "Serviettes hygiéniques jetables", "Pince à cheveux", "Coupe menstruelle", "Huiles essentielles", "Savon antibactérien liquide", "Épilateur électrique", "Cotons", "Répulsif anti-moustiques pour vêtements", "Fil dentaire", "Crayon Khôl", "Gel douche", "Ciseaux à ongles", "Shampoing solide", "Rouge à lèvres", "Lait démaquillant", "Flacons pour liquides en avion", "Après-shampoing", "Crême après solaire", "Huile de coco", "Lames de rasoir", "Porte savon", "Aloe vera", "Vernis à ongles", "Gant de toilette", "Cure Oreilles", "Bandes de cire froide", "Brosse à ongles", "Disque démaquillant lavable", "Dissolvant", "Rasoir électrique", "Far à paupières", "Tondeuse", "Gel/cire à cheveux", "Brossette pour les dents", "Mousse à raser", "Serviettes hygiéniques lavables", "Gant démaquillant"],
  },
  {
    category: "Trousse à pharmacie",
    items: ["Antalgique (douleur)", "Pansements", "Pansement digestif", "Antidiarrhéique", "Antiinflamatoire", "Antiseptique local", "Antibiotique à large spectre", "Pastilles purificatrices d’eau", "Désinfectant intestinal", "Antibiotique digestif", "Antiémétique (vomissements)", "Sérum physiologique", "Antispasmodique", "Antihistaminique (démangeaisons)", "Antipaludique", "Baume du Tigre", "Pilule contraceptive", "Antimigraineux", "Huiles essentielles", "Collyre", "Antibiotique urinaire", "Crème cicatrisante", "Crème pour brûlures", "Médicaments contre le mal des montagnes", "Pommade antibactérienne", "Bronchodilatateur", "Gouttes auriculaires", "Crème pour contusions", "Dermocorticoïdes (démangeaisons)", "Hydrogel antibrûlure", "Antimycosique", "Antispasmodique", "Médicaments contre le mal des transports", "Sels de réhydratation orale"],
  },
  {
    category: "Papiers",
    items: ["Passeport", "Cartes bancaires", "Certificat international de vaccination", "Espèces", "Photos d’identité", "Permis de conduire international", "Photocopies des documents importants", "Certificats d’assurance/assistance voyage", "Billets d’avion papier", "Carte d’identité", "Ordonnances", "Protège passeport", "Feuille avec les numéros d’urgence", "Notices des médicaments", "Carte de groupe sanguin", "Carte de certification de plongée", "Carte européenne d’assurance maladie", "Carte géographique", "Carte d’auberge de jeunesse", "Carnet de plongée", "Carte étudiant", "Certificat médical d’aptitude", "Livret de famille", "Carnets de santé des enfants", "Preuve de solvabilité bancaire", "Carte vitale", "Certificat de travail"],
  },
  {
    category: "Pour les enfants",
    items: ["T-shirt", "Bodie", "Robe/jupe", "Pull/gilet", "Blouson", "Pyjama", "Turbulette", "Culottes", "Pantalon", "Chaussettes", "Sandales", "Chaussures", "Chaussons", "Maillot de bain", "Bouée", "Jeux de bain/plage", "Serviette de plage", "Chapeau", "Lunettes de soleil", "Crème solaire", "Jouets", "Carnet de dessin", "Crayons", "Livres", "Porte-bébé", "Poussette", "Biberon", "Lait en poudre", "Tasse/gobelet", "Eau minérale", "Couverts", "Assiette", "Bavoir", "Lit de bébé tente", "Lit parapluie", "Veilleuse", "Moustiquaire", "Babyphone", "Carte d'identité", "Livret de famille", "Acte de naissance", "Passeport", "Carte européenne d'assurance maladie", "Carnet de santé", "Ordonnances", "Doliprane", "Crème fesses", "Thermomètre", "Sérum physiologique", "Mouche bébé", "Couches", "Sacs plastique", "Compresses", "Cotons", "Tapis de change", "Lingettes", "Liniment", "Savon bébé", "Baignoire gonflable", "Coupe ongles", "Serviettes de bain", "Tétine", "Chaise nomade", "Couverture", "Kit d'alaitement", "Doudou"],
  },
];
