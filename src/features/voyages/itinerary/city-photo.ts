import { useQuery } from "@tanstack/react-query";

/** Photo représentative d'une ville — pas de clé API requise, contrairement à TMDB/RAWG/Google
 * Places ailleurs dans l'app (les API MediaWiki de Wikipédia/Commons autorisent les appels
 * anonymes directs depuis un navigateur via `origin=*`). Plusieurs sources essayées en parallèle
 * avec un délai limite, dans cet ordre de priorité :
 *  1/2. `action=query&prop=pageimages` sur Wikipédia FR puis EN, titre exact — rapide, mais se
 *     trompe de page pour un nom de ville ambigu (ex. "Valladolid" tombe sur la ville d'Espagne,
 *     pas sur Valladolid au Yucatán) et ne renvoie rien si l'article n'a pas de photo d'infobox.
 *  3/4. Recherche plein texte "<ville> <pays>" (`generator=search`) sur Wikipédia FR puis EN —
 *     désambiguïse par le pays et retrouve une photo même quand l'article n'a pas de titre exact
 *     correspondant.
 *  5. Recherche d'image géolocalisée par mot-clé sur Wikimedia Commons — filet le plus large,
 *     pour les communes sans article illustré du tout.
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

/** Recherche plein texte (pas un titre exact) sur Wikipédia, avec le pays dans la requête pour
 * désambiguïser les noms de ville qui existent ailleurs dans le monde (Valladolid, Vientiane
 * étant pris comme Vientiane-le-pays vs. la ville, etc.) — `gsrsearch` fait du plein texte, donc
 * "Valladolid Mexique" remonte l'article sur la ville mexicaine même si son titre exact est
 * "Valladolid (Yucatán)". */
async function fetchWikipediaSearchImage(city: string, country: string | null, lang: "fr" | "en"): Promise<string | null> {
  const query = country ? `${city} ${country}` : city;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=1&gsrsearch=${encodeURIComponent(
    query
  )}&prop=pageimages&piprop=thumbnail&pithumbsize=640`;
  const data = (await fetchJson(url)) as PageImagesResponse | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  const source = Object.values(pages)[0]?.thumbnail?.source;
  return source ? upscaleThumbWidth(source) : null;
}

/** Recherche Commons par mot-clé, filtrée aux fichiers image — filet plus large que l'article
 * Wikipédia lui-même (beaucoup de communes ont des photos catégorisées sur Commons sans avoir
 * d'infobox photo sur leur article). `origin=*` active le CORS anonyme de l'API MediaWiki. */
async function fetchCommonsThumbnail(city: string, country: string | null): Promise<string | null> {
  const query = country ? `${city} ${country} filetype:bitmap` : `${city} filetype:bitmap`;
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(
    query
  )}&prop=imageinfo&iiprop=url&iiurlwidth=640`;
  const data = (await fetchJson(searchUrl)) as { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> } } | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0];
  return first?.imageinfo?.[0]?.thumburl ?? null;
}

async function fetchCityPhoto(city: string, country: string | null): Promise<string | null> {
  const [fr, en, frSearch, enSearch, commons] = await Promise.all([
    fetchWikipediaPageImage(city, "fr"),
    fetchWikipediaPageImage(city, "en"),
    fetchWikipediaSearchImage(city, country, "fr"),
    fetchWikipediaSearchImage(city, country, "en"),
    fetchCommonsThumbnail(city, country),
  ]);
  return fr ?? en ?? frSearch ?? enSearch ?? commons ?? null;
}

/** `city` à null désactive la requête (ex. une photo du Journal existe déjà pour cette ville,
 * inutile d'aller en chercher une autre). `country` améliore la désambiguïsation mais n'est pas
 * requis.
 * Le cache React Query est persisté dans le localStorage du navigateur (3 jours, cf.
 * query-client.tsx) : avec un `staleTime: Infinity` précédent, un premier résultat raté (`null`,
 * dû aux versions antérieures buguées de ce fichier) restait rejoué indéfiniment depuis ce cache
 * persistant, y compris après correction du code et redéploiement — la clé est donc versionnée
 * ("v3") pour forcer un nouveau fetch chez tout le monde une bonne fois, et le staleTime n'est
 * plus infini pour qu'un éventuel futur résultat raté s'auto-corrige après un jour. */
export function useCityPhoto(city: string | null, country: string | null = null) {
  return useQuery({
    queryKey: ["city-photo-v3", city, country],
    enabled: !!city,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: () => fetchCityPhoto(city as string, country),
  });
}
