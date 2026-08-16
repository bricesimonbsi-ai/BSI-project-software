// Proxy vers l'API IGDB (api.igdb.com, authentifiée via un jeton d'application Twitch) pour la
// recherche de jeux vidéo — remplace RAWG (service gratuit peu fiable, pannes fréquentes). Le
// secret Twitch (IGDB_CLIENT_SECRET) ne doit jamais être exposé côté navigateur, d'où ce relais
// serveur : le client envoie juste { action, query|id }, la fonction gère le jeton OAuth Twitch
// (client_credentials, mis en cache en mémoire tant que l'instance reste chaude) et l'appel IGDB.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GAME_FIELDS = "id,name,cover.image_id,first_release_date,rating,platforms.name";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Impossible d'obtenir un jeton Twitch (vérifie IGDB_CLIENT_ID/IGDB_CLIENT_SECRET)");
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function coverUrl(imageId: string | undefined): string | null {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null;
}

// IGDB note sur 100 ; on la ramène sur 10 pour rester cohérent avec le reste de l'app (TMDB).
function normalizeGame(g: any) {
  return {
    id: g.id,
    name: g.name,
    background_image: coverUrl(g.cover?.image_id),
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    rating: g.rating ? Math.round((g.rating / 10) * 10) / 10 : 0,
    platforms: (g.platforms ?? []).map((p: { name: string }) => ({ platform: { name: p.name } })),
  };
}

async function queryIgdb(clientId: string, token: string, body: string): Promise<any[]> {
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": clientId, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erreur IGDB (${res.status}) : ${text.slice(0, 200)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    if (!req.headers.get("Authorization")) return json({ error: "Non authentifié" }, 401);

    const clientId = Deno.env.get("IGDB_CLIENT_ID");
    const clientSecret = Deno.env.get("IGDB_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "IGDB_CLIENT_ID/IGDB_CLIENT_SECRET non configurés" }, 500);

    const { action, query, id } = await req.json();
    const token = await getTwitchToken(clientId, clientSecret);

    if (action === "search") {
      const q = String(query ?? "").trim();
      if (!q) return json({ results: [] });
      const escaped = q.replace(/"/g, '\\"');
      const games = await queryIgdb(clientId, token, `search "${escaped}"; fields ${GAME_FIELDS}; limit 10;`);
      return json({ results: games.map(normalizeGame) });
    }

    if (action === "trending") {
      const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000);
      const games = await queryIgdb(
        clientId,
        token,
        `fields ${GAME_FIELDS}; where first_release_date > ${ninetyDaysAgo} & hypes > 0; sort hypes desc; limit 12;`
      );
      return json({ results: games.map(normalizeGame) });
    }

    if (action === "detail") {
      if (!id) return json({ error: "id requis" }, 400);
      const games = await queryIgdb(clientId, token, `fields summary; where id = ${Number(id)}; limit 1;`);
      const summary = games[0]?.summary as string | undefined;
      return json({ description: summary ? summary.slice(0, 600) : null });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
