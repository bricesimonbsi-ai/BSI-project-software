import { useQuery } from "@tanstack/react-query";

/** Photo représentative d'une ville, tirée de Wikipédia (l'image de tête de l'article, presque
 * toujours un paysage/monument caractéristique) — pas de clé API requise (contrairement à TMDB/
 * RAWG/Google Places ailleurs dans l'app), l'API REST de Wikipédia autorisant les appels directs
 * depuis un navigateur (CORS ouvert). Essai en français puis en anglais si l'article n'existe pas
 * dans cette langue ; renvoie null en silence si aucune des deux ne trouve d'image (l'appelant
 * retombe alors sur un dégradé plutôt que de casser l'affichage).
 */
async function fetchWikipediaThumbnail(city: string, lang: "fr" | "en"): Promise<string | null> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Uniquement `thumbnail` (jamais `originalimage`, potentiellement un fichier de plusieurs Mo
    // — trop lourd pour une simple vignette de carte, surtout sur une connexion mobile lente).
    const source: string | undefined = data?.thumbnail?.source;
    if (!source) return null;
    // Les vignettes de l'API summary sont assez petites (souvent 320px de large) ; les URLs
    // Wikipédia encodent la largeur dans le chemin (".../320px-Nom.jpg") — l'agrandir donne une
    // image nette même en grand sur une carte d'étape plein écran.
    return source.replace(/\/\d+px-/, "/640px-");
  } catch {
    return null;
  }
}

async function fetchCityPhoto(city: string): Promise<string | null> {
  return (await fetchWikipediaThumbnail(city, "fr")) ?? (await fetchWikipediaThumbnail(city, "en"));
}

/** `city` à null désactive la requête (ex. une photo du Journal existe déjà pour cette ville,
 * inutile d'aller en chercher une autre). */
export function useCityPhoto(city: string | null) {
  return useQuery({
    queryKey: ["city-photo", city],
    enabled: !!city,
    staleTime: Infinity,
    queryFn: () => fetchCityPhoto(city as string),
  });
}
