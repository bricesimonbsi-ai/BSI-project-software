import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { usePeople } from "@/features/people/use-people";
import { useAgendaEvents, useAgendaEventParticipants, useSharedAgendas } from "@/features/agenda/use-agenda";
import { personDotColorClass, combinationDotColorClass } from "@/features/agenda/person-color";
import { AgendaEventDialog } from "@/features/agenda/agenda-event-dialog";
import { AgendaCollaboratorsPanel } from "@/features/agenda/agenda-collaborators-panel";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { formatDate, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Share2, MapPin, CalendarDays } from "lucide-react";
import type { AgendaEvent, Person } from "@/types/database";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

/** 42 jours (6 semaines, lundi en première colonne) couvrant le mois affiché, avec le
 * "débordement" des mois précédent/suivant pour compléter la grille. */
function buildMonthGrid(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

/**
 * Agenda partageable — vue globale unique (pas un module par projet), accessible depuis la nav.
 * Grille mensuelle légère (CSS grid, pas de dépendance calendrier externe), puces colorées par
 * participant (couleur stable dérivée de la position dans le répertoire "Personnes", voir
 * person-color.ts), et sélecteur pour basculer vers un agenda partagé avec moi par un
 * collaborateur (useSharedAgendas).
 */
export function AgendaPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const myId = session?.user.id ?? "";
  const ownerId = searchParams.get("owner") || myId;
  const isOwner = ownerId === myId;

  const { data: sharedAgendas } = useSharedAgendas();
  const myPermission = sharedAgendas?.find((a) => a.ownerId === ownerId)?.permission;
  const canWrite = isOwner || myPermission === "write";

  const { data: people } = usePeople();
  const { data: events } = useAgendaEvents(ownerId);
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { data: participants } = useAgendaEventParticipants(ownerId, eventIds);

  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultDate, setDialogDefaultDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<(AgendaEvent & { participantIds: string[] }) | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const participantsByEvent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of participants ?? []) {
      const list = map.get(p.event_id) ?? [];
      list.push(p.person_id);
      map.set(p.event_id, list);
    }
    return map;
  }, [participants]);

  // Un événement qui dure plusieurs jours doit apparaître dans CHAQUE case qu'il couvre (pas
  // seulement le jour de début) — on parcourt donc la plage start_at → end_at jour par jour.
  // Plafond de sécurité à 366 jours pour ne jamais boucler indéfiniment sur une donnée aberrante.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const e of events ?? []) {
      const startDay = startOfDay(new Date(e.start_at));
      const endDay = startOfDay(new Date(e.end_at ?? e.start_at));
      const cursor = new Date(startDay);
      let guard = 0;
      while (cursor.getTime() <= endDay.getTime() && guard < 366) {
        const key = dateKey(cursor);
        map.set(key, [...(map.get(key) ?? []), e]);
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
    }
    return map;
  }, [events]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return (events ?? [])
      .filter((e) => new Date(e.end_at ?? e.start_at) >= now)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 8);
  }, [events]);

  function openCreateDialog(day: Date) {
    setEditingEvent(null);
    setDialogDefaultDate(day);
    setDialogOpen(true);
  }

  function openEditDialog(event: AgendaEvent) {
    setEditingEvent({ ...event, participantIds: participantsByEvent.get(event.id) ?? [] });
    setDialogDefaultDate(null);
    setDialogOpen(true);
  }

  const selectedDayEvents = selectedDay ? eventsByDay.get(dateKey(selectedDay)) ?? [] : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeroCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Agenda</h1>
          </div>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-2 h-4 w-4" /> Partager
            </Button>
          )}
        </div>
        {sharedAgendas && sharedAgendas.length > 0 && (
          <Select value={ownerId} onValueChange={(v) => setSearchParams((prev) => ({ ...Object.fromEntries(prev), owner: v }))}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={myId}>Mon agenda</SelectItem>
              {sharedAgendas.map((a) => (
                <SelectItem key={a.ownerId} value={a.ownerId}>
                  Agenda de {a.ownerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeroCard>

      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold capitalize">{MONTH_FORMATTER.format(month)}</p>
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold text-muted-foreground">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            const today = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-h-20 flex-col items-start gap-0.5 rounded-md border p-1 text-left transition-colors",
                  inMonth ? "border-border/60 bg-background" : "border-transparent bg-muted/30 text-muted-foreground",
                  today && "border-accent"
                )}
              >
                <span className={cn("text-xs", today && "font-bold text-accent")}>{day.getDate()}</span>
                <div className="flex w-full flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map((e) => {
                    const dotClass = combinationDotColorClass(participantsByEvent.get(e.id) ?? [], people ?? []);
                    return (
                      <span
                        key={e.id}
                        title={e.title}
                        className="flex items-center gap-1 truncate rounded bg-secondary px-1 py-0.5 text-[0.6rem] leading-tight"
                      >
                        <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", dotClass)} />
                        <span className="truncate">{e.title}</span>
                      </span>
                    );
                  })}
                  {dayEvents.length > 2 && <span className="text-[0.6rem] text-muted-foreground">+{dayEvents.length - 2}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Prochains événements</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien de prévu pour l'instant.</p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} people={people ?? []} participantIds={participantsByEvent.get(e.id) ?? []} onOpen={() => openEditDialog(e)} />
            ))}
          </div>
        )}
      </div>

      {canWrite && (
        <Button onClick={() => openCreateDialog(new Date())}>
          <Plus className="mr-2 h-4 w-4" /> Nouvel événement
        </Button>
      )}

      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedDay && formatDate(dateKey(selectedDay))}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien ce jour-là.</p>
            ) : (
              selectedDayEvents.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  people={people ?? []}
                  participantIds={participantsByEvent.get(e.id) ?? []}
                  onOpen={() => {
                    setSelectedDay(null);
                    openEditDialog(e);
                  }}
                />
              ))
            )}
            {canWrite && selectedDay && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const day = selectedDay;
                  setSelectedDay(null);
                  openCreateDialog(day);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Ajouter un événement
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {canWrite && (
        <AgendaEventDialog ownerId={ownerId} open={dialogOpen} editingEvent={editingEvent} defaultDate={dialogDefaultDate} onOpenChange={setDialogOpen} />
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Partager mon agenda</DialogTitle>
          </DialogHeader>
          <AgendaCollaboratorsPanel ownerId={ownerId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventRow({
  event,
  people,
  participantIds,
  onOpen,
}: {
  event: AgendaEvent;
  people: Person[];
  participantIds: string[];
  onOpen: () => void;
}) {
  const start = new Date(event.start_at);
  const namesById = new Map(people.map((p) => [p.id, p.name]));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md border border-border/60 bg-card p-2.5 text-left hover:bg-secondary"
    >
      <div className="flex w-14 flex-shrink-0 flex-col items-center text-xs text-muted-foreground">
        <span>{formatDate(dateKey(start))}</span>
        {!event.all_day && <span>{TIME_FORMATTER.format(start)}</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{event.title}</p>
        {event.location && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" /> {event.location}
          </p>
        )}
      </div>
      {participantIds.length > 0 && (
        <div className="flex flex-shrink-0 -space-x-1">
          {participantIds.slice(0, 4).map((pid) => (
            <span
              key={pid}
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-card ${personDotColorClass(pid, people)}`}
              title={namesById.get(pid)}
            />
          ))}
        </div>
      )}
    </button>
  );
}
