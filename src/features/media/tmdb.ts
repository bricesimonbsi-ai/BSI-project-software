/** Client TMDB (The Movie Database) côté navigateur — recherche de films et récupération des
 * affiches. La clé est injectée au build via une variable d'environnement (jamais codée en dur
 * ni committée) : VITE_TMDB_API_KEY, à définir dans les variables d'environnement Vercel.
 * Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB. */

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";

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

export async function searchMovies(query: string): Promise<TmdbMovieResult[]> {
  if (!API_KEY) throw new Error("Clé API TMDB non configurée (VITE_TMDB_API_KEY manquante).");
  if (!query.trim()) return [];
  const url = new URL(`${BASE_URL}/search/movie`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("language", "fr-FR");
  url.searchParams.set("include_adult", "false");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Erreur lors de la recherche TMDB");
  const data = await res.json();
  return (data.results ?? []) as TmdbMovieResult[];
}
