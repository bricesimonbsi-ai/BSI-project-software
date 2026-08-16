/** Client IGDB côté navigateur — recherche/tendances de jeux vidéo, relayées via l'Edge Function
 * igdb-search (le secret Twitch ne doit jamais être exposé côté client, contrairement à TMDB/RAWG
 * qui utilisaient une clé publique directe). Remplace rawg.ts, RAWG s'étant révélé peu fiable.
 * VITE_IGDB_ENABLED=true à définir dans les variables d'environnement Vercel une fois l'Edge
 * Function déployée et les secrets IGDB_CLIENT_ID/IGDB_CLIENT_SECRET configurés dans Supabase
 * (compte développeur Twitch gratuit sur https://dev.twitch.tv/console/apps). */
import { supabase } from "@/lib/supabase/client";

const ENABLED = (import.meta.env.VITE_IGDB_ENABLED as string | undefined) === "true";

export function isIgdbConfigured(): boolean {
  return ENABLED;
}

export type IgdbGameResult = {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
  rating: number;
  platforms?: { platform: { name: string } }[];
};

async function invoke(action: string, params: Record<string, string> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke("igdb-search", { body: { action, ...params } });
  if (error) {
    let detail = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) detail = body.error;
      } catch {
        // corps non exploitable : on garde le message générique
      }
    }
    throw new Error(detail);
  }
  return data;
}

export async function searchGames(query: string): Promise<IgdbGameResult[]> {
  if (!query.trim()) return [];
  const data = await invoke("search", { query });
  return (data.results ?? []) as IgdbGameResult[];
}

export async function trendingGames(): Promise<IgdbGameResult[]> {
  const data = await invoke("trending");
  return (data.results ?? []) as IgdbGameResult[];
}

/** Description longue, absente des résultats de recherche/tendances — appel détaillé,
 * best-effort, silencieux en cas d'échec. */
export async function fetchGameDescription(externalId: string): Promise<string | null> {
  try {
    const data = await invoke("detail", { id: externalId });
    return (data.description as string | null) ?? null;
  } catch {
    return null;
  }
}
