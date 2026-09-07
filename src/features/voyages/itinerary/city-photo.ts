import { useQuery } from "@tanstack/react-query";

/** Photo représentative d'une ville — pas de clé API requise, contrairement à TMDB/RAWG/Google
 * Places ailleurs dans l'app (l'API REST de Wikipédia et l'API Commons autorisent les appels
 * directs depuis un navigateur, CORS ouvert). Deux sources essayées en parallèle avec un délai
 * limite (beaucoup de petites villes n'ont pas de photo de tête sur leur article Wikipédia, d'où
 * le repli Commons) :
 *  1. L'image de tête de l'article Wikipédia (FR puis EN) — la plus fiable quand elle existe.
 *  2. Une recherche d'image géolocalisée sur Wikimedia Commons — filet plus large pour les
 *     communes sans infobox photo sur leur article.
 * Renvoie null en silence si rien n'est trouvé (l'appelant retombe alors sur un dégradé).
 */

const FETCH_TIMEOUT_MS = 7000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Les vignettes de l'API summary sont assez petites (souvent 320px de large) ; les URLs
 * Wikipédia/Commons encodent la largeur dans le chemin (".../320px-Nom.jpg") — l'agrandir donne
 * une image nette même en grand sur une carte d'étape plein écran. */
function upscaleThumbWidth(url: string, width = 640): string {
  return url.replace(/\/\d+px-/, `/${width}px-`);
}

async function fetchWikipediaThumbnail(city: string, lang: "fr" | "en"): Promise<string | null> {
  const data = (await fetchJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`)) as
    | { thumbnail?: { source?: string } }
    | null;
  const source = data?.thumbnail?.source;
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
    fetchWikipediaThumbnail(city, "fr"),
    fetchWikipediaThumbnail(city, "en"),
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
