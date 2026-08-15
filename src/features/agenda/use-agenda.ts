import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";
import { toast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/app-url";
import type { AgendaEvent, AgendaEventParticipant, AgendaCollaborator, Permission, Person, Profile } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

export function useAgendaEvents(ownerId: string | undefined) {
  return useQuery({
    queryKey: ["agenda-events", ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<AgendaEvent[]> => {
      const { data, error } = await supabase
        .from("agenda_events")
        .select("*")
        .eq("owner_id", ownerId as string)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type ParticipantRow = AgendaEventParticipant & { people: Person };

export function useAgendaEventParticipants(ownerId: string | undefined, eventIds: string[]) {
  const idsKey = [...eventIds].sort().join(",");
  return useQuery({
    queryKey: ["agenda-event-participants", ownerId, idsKey],
    enabled: !!ownerId && eventIds.length > 0,
    queryFn: async (): Promise<ParticipantRow[]> => {
      const { data, error } = await supabase.from("agenda_event_participants").select("*, people(*)").in("event_id", eventIds);
      if (error) throw error;
      return (data ?? []) as unknown as ParticipantRow[];
    },
  });
}

export type AgendaEventInput = {
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  participantPersonIds: string[];
};

export function useCreateAgendaEvent(ownerId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: AgendaEventInput) => {
      if (!session) throw new Error("Non authentifié");
      const { data: event, error } = await supabase
        .from("agenda_events")
        .insert({
          owner_id: ownerId,
          title: input.title,
          description: input.description,
          location: input.location,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          created_by: session.user.id,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (input.participantPersonIds.length > 0) {
        const { error: participantsError } = await supabase
          .from("agenda_event_participants")
          .insert(input.participantPersonIds.map((person_id) => ({ event_id: event.id, person_id })));
        if (participantsError) throw participantsError;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agenda-events", ownerId] }),
    onError: onMutationError,
  });
}

export function useUpdateAgendaEvent(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AgendaEventInput & { id: string }) => {
      const { error } = await supabase
        .from("agenda_events")
        .update({
          title: input.title,
          description: input.description,
          location: input.location,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;

      // Remplace la liste des participants (pas d'historique à conserver) — même principe que
      // useToggleVisited pour les visiteurs d'un lieu (use-restaurant-list.ts).
      const { error: clearError } = await supabase.from("agenda_event_participants").delete().eq("event_id", input.id);
      if (clearError) throw clearError;

      if (input.participantPersonIds.length > 0) {
        const { error: insertError } = await supabase
          .from("agenda_event_participants")
          .insert(input.participantPersonIds.map((person_id) => ({ event_id: input.id, person_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-events", ownerId] });
      queryClient.invalidateQueries({ queryKey: ["agenda-event-participants", ownerId] });
    },
    onError: onMutationError,
  });
}

export function useDeleteAgendaEvent(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agenda-events", ownerId] }),
    onError: onMutationError,
  });
}

export function useAgendaCollaborators(ownerId: string) {
  return useQuery({
    queryKey: ["agenda-collaborators", ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<AgendaCollaborator[]> => {
      const { data, error } = await supabase.from("agenda_collaborators").select("*").eq("owner_id", ownerId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Invite un collaborateur à mon agenda — même schéma que useAddCollaborator
 * (use-collaborators.ts) : l'accès (insertion ci-dessous) est déjà accordé même si l'envoi de
 * l'email échoue, on avertit juste l'utilisateur dans ce cas plutôt que de faire échouer toute
 * l'opération. */
export function useAddAgendaCollaborator(ownerId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { email: string; permission: Permission }) => {
      if (!session) throw new Error("Non authentifié");
      const email = input.email.toLowerCase().trim();
      const { error } = await supabase.from("agenda_collaborators").insert({
        owner_id: ownerId,
        email,
        permission: input.permission,
        invited_by: session.user.id,
      });
      if (error) throw error;

      try {
        const { data, error: inviteError } = await supabase.functions.invoke("invite-agenda-collaborator", {
          body: { owner_id: ownerId, email, redirect_to: `${APP_URL}/accept-invite` },
        });
        if (inviteError) {
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
      queryClient.invalidateQueries({ queryKey: ["agenda-collaborators", ownerId] });
      if (!result.emailSent) {
        toast({
          title: "Collaborateur ajouté, mais l'email a échoué",
          description: result.emailError
            ? `${result.emailError} — préviens la personne toi-même en attendant.`
            : "L'email d'invitation n'a pas pu être envoyé — préviens la personne toi-même.",
          variant: "destructive",
        });
      } else if (result.alreadyRegistered) {
        toast({ title: "Collaborateur ajouté", description: "Cette personne a déjà un compte : elle voit l'agenda dès sa prochaine connexion." });
      } else {
        toast({ title: "Invitation envoyée", description: "Un email vient d'être envoyé pour créer l'accès." });
      }
    },
    onError: onMutationError,
  });
}

export function useRemoveAgendaCollaborator(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agenda-collaborators", ownerId] }),
    onError: onMutationError,
  });
}

export type SharedAgenda = { ownerId: string; ownerName: string; permission: Permission };

/** Agendas d'autres comptes auxquels j'ai accès en tant que collaborateur — alimente le
 * sélecteur "Mon agenda / Agenda de {nom}" sur la page, et détermine si les contrôles
 * d'écriture (ajouter/modifier/supprimer un événement, partager) doivent s'afficher. */
export function useSharedAgendas() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["shared-agendas", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<SharedAgenda[]> => {
      // agenda_collaborators a 3 clés étrangères vers profiles (owner_id, user_id, invited_by) :
      // le hint "!owner_id" est nécessaire pour lever l'ambiguïté, sinon PostgREST ne sait pas
      // laquelle utiliser pour la jointure imbriquée.
      const { data, error } = await supabase
        .from("agenda_collaborators")
        .select("owner_id, permission, profiles!owner_id(display_name, email)")
        .eq("user_id", session!.user.id);
      if (error) throw error;
      return ((data ?? []) as unknown as { owner_id: string; permission: Permission; profiles: Profile | null }[]).map((r) => ({
        ownerId: r.owner_id,
        ownerName: r.profiles?.display_name || r.profiles?.email || "Collaborateur",
        permission: r.permission,
      }));
    },
  });
}
