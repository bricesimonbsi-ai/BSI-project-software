import { useQuery } from "@tanstack/react-query";

/** Photo représentative d'une ville — pas de clé API requise, contrairement à TMDB/RAWG/Google
 * Places ailleurs dans l'app (les API MediaWiki de Wikipédia/Commons autorisent les appels
 * anonymes directs depuis un navigateur via `origin=*`). Trois sources essayées en parallèle avec
 * un délai limite :
 *  1/2. `action=query&prop=pageimages` sur Wikipédia FR puis EN — l'API MediaWiki "classique"
 *     (utilisée par la plupart des outils tiers pour cet usage), plus robuste que l'API REST
 *     `page/summary` essayée dans une première version et qui ne remontait aucune photo en
 *     production, y compris pour des villes largement illustrées comme Nantes.
 *  3. Une recherche d'image géolocalisée sur Wikimedia Commons — filet plus large pour les
 *     communes sans photo de tête sur leur article.
 * Renvoie null en silence si rien n'est trouvé (l'appelant retombe alors sur un dégradé) ; les
 * échecs réseau/réponse sont journalisés en `console.warn` (jamais visibles pour l'utilisateur,
 * utiles pour diagnostiquer si le problème persiste).
 */

const FETCH_TIMEOUT_MS = 7000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[city-photo] réponse non-OK (${res.status}) pour ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[city-photo] échec de requête pour ${url}`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Les vignettes sont assez petites par défaut ; les URLs Wikipédia/Commons encodent la largeur
 * dans le chemin (".../320px-Nom.jpg") — l'agrandir donne une image nette même en grand sur une
 * carte d'étape plein écran. */
function upscaleThumbWidth(url: string, width = 640): string {
  return url.replace(/\/\d+px-/, `/${width}px-`);
}

type PageImagesResponse = { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };

async function fetchWikipediaPageImage(city: string, lang: "fr" | "en"): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=640&titles=${encodeURIComponent(
    city
  )}`;
  const data = (await fetchJson(url)) as PageImagesResponse | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  const source = Object.values(pages)[0]?.thumbnail?.source;
  return source ? upscaleThumbWidth(source) : null;
}

/** Recherche Commons par mot-clé, filtrée aux fichiers image — filet plus large que l'article
 * Wikipédia lui-même (beaucoup de communes ont des photos catégorisées sur Commons sans avoir
 * d'infobox photo sur leur article). `origin=*` active le CORS anonyme de l'API MediaWiki. */
async function fetchCommonsThumbnail(city: string): Promise<string | null> {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(
    `${city} filetype:bitmap`
  )}&prop=imageinfo&iiprop=url&iiurlwidth=640`;
  const data = (await fetchJson(searchUrl)) as { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> } } | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0];
  return first?.imageinfo?.[0]?.thumburl ?? null;
}

async function fetchCityPhoto(city: string): Promise<string | null> {
  const [fr, en, commons] = await Promise.all([
    fetchWikipediaPageImage(city, "fr"),
    fetchWikipediaPageImage(city, "en"),
    fetchCommonsThumbnail(city),
  ]);
  return fr ?? en ?? commons ?? null;
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
