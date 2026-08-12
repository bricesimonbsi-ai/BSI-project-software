/** Client RAWG (rawg.io) côté navigateur — recherche/tendances de jeux vidéo, avec les plateformes
 * (consoles/PC) disponibles renvoyées directement par l'API (pas d'appel séparé, contrairement à
 * TMDB pour "où le voir"). La clé est injectée au build via une variable d'environnement (jamais
 * codée en dur ni committée) : VITE_RAWG_API_KEY, à définir dans les variables d'environnement
 * Vercel — un compte gratuit se crée sur https://rawg.io/apidocs. */

const API_KEY = import.meta.env.VITE_RAWG_API_KEY as string | undefined;
const BASE_URL = "https://api.rawg.io/api";

export function isRawgConfigured(): boolean {
  return !!API_KEY;
}

export type RawgGameResult = {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
  rating: number;
  platforms?: { platform: { name: string } }[];
};

async function rawgGet(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!API_KEY) throw new Error("Clé API RAWG non configurée (VITE_RAWG_API_KEY manquante).");
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("key", API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Erreur lors de l'appel à RAWG");
  return res.json();
}

export async function searchGames(query: string): Promise<RawgGameResult[]> {
  if (!query.trim()) return [];
  const data = await rawgGet("/games", { search: query, page_size: "10" });
  return (data.results ?? []) as RawgGameResult[];
}

/** "Nouveautés" façon RAWG : jeux les plus ajoutés par les utilisateurs sur les 90 derniers
 * jours — RAWG n'a pas d'endpoint "trending" dédié, c'est l'approximation usuelle. */
export async function trendingGames(): Promise<RawgGameResult[]> {
  const now = new Date();
  const past = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await rawgGet("/games", { dates: `${fmt(past)},${fmt(now)}`, ordering: "-added", page_size: "12" });
  return (data.results ?? []) as RawgGameResult[];
}

/** Description longue, absente des résultats de recherche/tendances RAWG (nécessite un appel
 * détaillé) — best-effort, silencieux en cas d'échec. */
export async function fetchGameDescription(externalId: string): Promise<string | null> {
  try {
    const data = await rawgGet(`/games/${externalId}`);
    const raw = data.description_raw as string | undefined;
    return raw ? raw.slice(0, 600) : null;
  } catch {
    return null;
  }
}
