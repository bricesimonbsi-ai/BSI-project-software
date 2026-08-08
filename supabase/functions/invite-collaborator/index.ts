// Envoie une invitation par email pour un collaborateur de projet, via le système natif
// Supabase Auth (admin.inviteUserByEmail) — aucune infrastructure d'envoi tierce nécessaire.
// Doit être appelée avec le token de l'utilisateur qui invite (déjà fait automatiquement par
// supabase.functions.invoke côté client) ; vérifie elle-même que cet utilisateur a bien un accès
// en écriture au projet concerné avant d'envoyer quoi que ce soit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, email, redirect_to } = await req.json();
    if (!project_id || !email) {
      return new Response(JSON.stringify({ error: "project_id et email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasAccess, error: accessError } = await admin.rpc("has_project_access", {
      pid: project_id,
      uid: userData.user.id,
      require_write: true,
    });
    if (accessError || !hasAccess) {
      return new Response(JSON.stringify({ error: "Accès refusé à ce projet" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo: redirect_to });

    if (inviteError) {
      // Un compte existe déjà avec cet email : pas d'email natif possible dans ce cas (Supabase
      // n'envoie l'invite que pour un nouveau compte), donc on relie directement la ligne en
      // attente au compte existant — la personne verra le projet à sa prochaine connexion.
      const alreadyRegistered = inviteError.status === 422 || /already been registered|already exists/i.test(inviteError.message ?? "");
      if (alreadyRegistered) {
        const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();
        if (existingProfile) {
          await admin
            .from("project_collaborators")
            .update({ user_id: existingProfile.id })
            .eq("project_id", project_id)
            .eq("email", normalizedEmail);
        }
        return new Response(JSON.stringify({ ok: true, alreadyRegistered: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
