/** Client TMDB (The Movie Database) côté navigateur — recherche/tendances de films et séries,
 * affiches, et plateformes de streaming où les regarder (région France). La clé est injectée au
 * build via une variable d'environnement (jamais codée en dur ni committée) : VITE_TMDB_API_KEY,
 * à définir dans les variables d'environnement Vercel.
 * Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB. */

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";
const WATCH_REGION = "FR";

export function isTmdbConfigured(): boolean {
  return !!API_KEY;
}

export function tmdbPosterUrl(posterPath: string | null): string | null {
  return posterPath ? `${IMAGE_BASE_URL}${posterPath}` : null;
}

export type TmdbMovieResult = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number;
};

export type TmdbTvResult = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string | null;
  vote_average: number;
};

async function tmdbGet(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!API_KEY) throw new Error("Clé API TMDB non configurée (VITE_TMDB_API_KEY manquante).");
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Erreur lors de l'appel à TMDB");
  return res.json();
}

export async function searchMovies(query: string): Promise<TmdbMovieResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbGet("/search/movie", { query, include_adult: "false" });
  return (data.results ?? []) as TmdbMovieResult[];
}

export async function searchTvShows(query: string): Promise<TmdbTvResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbGet("/search/tv", { query, include_adult: "false" });
  return (data.results ?? []) as TmdbTvResult[];
}

export async function trendingMovies(): Promise<TmdbMovieResult[]> {
  const data = await tmdbGet("/trending/movie/week");
  return (data.results ?? []) as TmdbMovieResult[];
}

export async function trendingTvShows(): Promise<TmdbTvResult[]> {
  const data = await tmdbGet("/trending/tv/week");
  return (data.results ?? []) as TmdbTvResult[];
}

/** Nombre de saisons/épisodes d'une série — absent de /search/tv, nécessite un appel détaillé
 * (/tv/{id}), fait une seule fois au moment de l'ajout à la liste. Best-effort : null en cas
 * d'échec plutôt que de bloquer l'ajout. */
export async function fetchTvSeasonEpisodeCount(externalId: string): Promise<{ seasons: number | null; episodes: number | null }> {
  try {
    const data = await tmdbGet(`/tv/${externalId}`);
    return { seasons: data.number_of_seasons ?? null, episodes: data.number_of_episodes ?? null };
  } catch {
    return { seasons: null, episodes: null };
  }
}

/** Plateformes de streaming où regarder un film/série en France (abonnement, sinon location/achat
 * à défaut) — renvoie une liste de noms lisibles ("Netflix", "Canal+"...), vide si non disponible
 * (ou données absentes pour la région). Alimente automatiquement le champ "Où le voir". */
export async function fetchWatchProviders(mediaKind: "movie" | "tv", externalId: string): Promise<string[]> {
  try {
    const data = await tmdbGet(`/${mediaKind}/${externalId}/watch/providers`);
    const region = data.results?.[WATCH_REGION];
    if (!region) return [];
    const providers = region.flatrate ?? region.free ?? region.ads ?? region.rent ?? region.buy ?? [];
    return [...new Set((providers as { provider_name: string }[]).map((p) => p.provider_name))];
  } catch {
    return [];
  }
}
