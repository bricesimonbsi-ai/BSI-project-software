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
      // Un compte existe déjà avec cet email. Deux cas très différents :
      // - une vraie personne déjà inscrite et confirmée : pas d'email natif possible (Supabase
      //   n'invite que les nouveaux comptes), on relie juste la ligne en attente, elle verra le
      //   projet à sa prochaine connexion normale ;
      // - un compte "fantôme" créé par une invitation précédente jamais finalisée (lien cassé,
      //   expiré, deuxième clic...) : personne n'a jamais pu se connecter avec, il faut le
      //   supprimer et réinviter proprement pour obtenir un lien tout neuf, sinon la personne
      //   reste bloquée indéfiniment sans jamais recevoir d'email valide.
      // Détection au message uniquement : le code HTTP 422 seul est trop générique (une URL de
      // redirection non autorisée renvoie aussi un 422) et masquerait la vraie cause de l'échec.
      const alreadyRegistered = /already been registered|already exists|already registered/i.test(inviteError.message ?? "");
      if (alreadyRegistered) {
        const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();

        if (existingProfile) {
          const { data: existingUser } = await admin.auth.admin.getUserById(existingProfile.id);
          const neverConfirmed = !existingUser?.user?.email_confirmed_at && !existingUser?.user?.last_sign_in_at;

          if (neverConfirmed) {
            // La suppression du compte entraîne en cascade la suppression des lignes
            // project_collaborators qui le référencent (contrainte "on delete cascade" sur
            // profiles) — on les sauvegarde donc avant, pour les recréer juste après en attente
            // du nouveau compte (le trigger handle_new_user les relira automatiquement).
            const { data: pendingRows } = await admin
              .from("project_collaborators")
              .select("project_id, permission, invited_by")
              .eq("user_id", existingProfile.id);

            await admin.auth.admin.deleteUser(existingProfile.id);

            if (pendingRows && pendingRows.length > 0) {
              await admin.from("project_collaborators").insert(
                pendingRows.map((r) => ({
                  project_id: r.project_id,
                  email: normalizedEmail,
                  permission: r.permission,
                  invited_by: r.invited_by,
                  user_id: null,
                }))
              );
            }

            const { error: retryError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo: redirect_to });
            if (retryError) {
              return new Response(JSON.stringify({ error: retryError.message }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

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
