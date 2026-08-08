import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import type { Permission, ProjectCollaborator } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

// Domaine fixe volontairement codé en dur plutôt que window.location.origin : les invitations
// peuvent être envoyées depuis un déploiement de prévisualisation Vercel éphémère (URL qui
// n'existera plus quelques jours après), le lien de l'email doit toujours pointer vers le
// domaine de production stable pour rester valide.
const APP_URL = "https://www.projeko.fr";

export function useCollaborators(projectId: string) {
  return useQuery({
    queryKey: ["collaborators", projectId],
    queryFn: async (): Promise<ProjectCollaborator[]> => {
      const { data, error } = await supabase.from("project_collaborators").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddCollaborator(projectId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { email: string; permission: Permission }) => {
      if (!session) throw new Error("Non authentifié");
      const email = input.email.toLowerCase().trim();
      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        email,
        permission: input.permission,
        invited_by: session.user.id,
      });
      if (error) throw error;

      // L'email d'invitation est un plus, pas une condition de succès : l'accès (ligne ci-dessus)
      // est déjà accordé même si l'envoi échoue — on avertit juste l'utilisateur dans ce cas au
      // lieu de faire passer toute l'opération pour ratée.
      try {
        const { data, error: inviteError } = await supabase.functions.invoke("invite-collaborator", {
          body: { project_id: projectId, email, redirect_to: `${APP_URL}/accept-invite` },
        });
        if (inviteError) {
          // Le message par défaut de l'erreur ("Edge Function returned a non-2xx status code")
          // n'est pas exploitable : le vrai message renvoyé par la fonction est dans le corps de
          // la réponse HTTP (context), pas dans .message.
          let detail = inviteError.message;
          const context = (inviteError as { context?: Response }).context;
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
        return { emailSent: true, alreadyRegistered: !!(data as { alreadyRegistered?: boolean } | null)?.alreadyRegistered };
      } catch (err) {
        return { emailSent: false, emailError: (err as Error).message };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["collaborators", projectId] });
      if (!result.emailSent) {
        toast({
          title: "Collaborateur ajouté, mais l'email a échoué",
          description: result.emailError
            ? `${result.emailError} — préviens la personne toi-même en attendant.`
            : "L'email d'invitation n'a pas pu être envoyé — préviens la personne toi-même.",
          variant: "destructive",
        });
      } else if (result.alreadyRegistered) {
        toast({ title: "Collaborateur ajouté", description: "Cette personne a déjà un compte : elle voit le projet dès sa prochaine connexion." });
      } else {
        toast({ title: "Invitation envoyée", description: "Un email vient d'être envoyé pour créer l'accès." });
      }
    },
    onError: onMutationError,
  });
}

export function useRemoveCollaborator(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collaborators", projectId] }),
    onError: onMutationError,
  });
}
