import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { usePeople } from "@/features/people/use-people";
import { useAgendaEvents, useAgendaEventParticipants } from "@/features/agenda/use-agenda";
import { expandEventOccurrences } from "@/features/agenda/recurrence";
import { EventRow } from "@/features/agenda/agenda-page";

/** Aperçu des prochains événements de MON agenda sur la page d'accueil — pas les agendas
 * partagés avec moi (cf. sélecteur "owner" de la page Agenda), pour rester un résumé simple. */
export function AgendaPreview() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const navigate = useNavigate();
  const { data: people } = usePeople();
  const { data: events } = useAgendaEvents(ownerId);
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { data: participants } = useAgendaEventParticipants(ownerId, eventIds);

  const participantsByEvent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of participants ?? []) {
      map.set(p.event_id, [...(map.get(p.event_id) ?? []), p.person_id]);
    }
    return map;
  }, [participants]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const rangeEnd = new Date(now);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);
    return (events ?? [])
      .flatMap((e) => expandEventOccurrences(e, now, rangeEnd))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 4);
  }, [events]);

  if (upcoming.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prochains événements</h2>
        <button type="button" onClick={() => navigate("/agenda")} className="text-sm text-accent hover:underline">
          Voir l'agenda
        </button>
      </div>
      <div className="space-y-1.5">
        {upcoming.map((e) => (
          <EventRow
            key={e.occurrenceKey}
            event={e}
            people={people ?? []}
            participantIds={participantsByEvent.get(e.id) ?? []}
            onOpen={() => navigate("/agenda")}
          />
        ))}
      </div>
    </div>
  );
}
