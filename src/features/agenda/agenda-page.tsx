import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useAuth } from "@/app/providers/auth-provider";
import { usePeople } from "@/features/people/use-people";
import { useAgendaEvents, useAgendaEventParticipants, useSharedAgendas, useUpdateAgendaEvent } from "@/features/agenda/use-agenda";
import { combinationDotColorClass, personColorIndex } from "@/features/agenda/person-color";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { AgendaEventDialog } from "@/features/agenda/agenda-event-dialog";
import { AgendaCollaboratorsPanel } from "@/features/agenda/agenda-collaborators-panel";
import { expandEventOccurrences, type AgendaOccurrence } from "@/features/agenda/recurrence";
import { WEEKDAY_LABELS, MONTH_FORMATTER, MONTH_SHORT_FORMATTER, startOfDay, dateKey, isSameDay, buildMonthGrid, daysBetween } from "@/features/agenda/calendar-utils";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { formatDate, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Share2, MapPin, CalendarDays, Repeat } from "lucide-react";
import type { AgendaEvent, Person } from "@/types/database";

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Seuil de déplacement horizontal (px) à partir duquel un geste tactile est traité comme un
 * swipe de changement de mois plutôt qu'un simple défilement vertical de la page. */
const SWIPE_THRESHOLD_PX = 50;

const MAX_WEEK_LANES = 3;

type WeekBar = { occurrence: AgendaOccurrence; startCol: number; endCol: number; lane: number };

/**
 * Pour une semaine (7 jours) de la grille, calcule des barres continues par occurrence (colonne de
 * début → colonne de fin, clippées à la semaine) réparties sur des "voies" (lanes) pour éviter que
 * deux occurrences simultanées se chevauchent visuellement — comme un planning Gantt compact. Une
 * occurrence qui déborde le nombre max de voies affichées est comptée dans `overflowByDay` (jour
 * par jour couvert) plutôt que dessinée, pour ne pas faire exploser la hauteur de la grille.
 */
function layoutWeekBars(
  week: Date[],
  occurrences: AgendaOccurrence[]
): { bars: WeekBar[]; laneCount: number; overflowByDay: Map<string, number> } {
  const weekStart = week[0];
  const weekEnd = week[6];
  const relevant = occurrences
    .map((o) => {
      const s = startOfDay(new Date(o.start_at));
      const en = startOfDay(new Date(o.end_at ?? o.start_at));
      if (en < weekStart || s > weekEnd) return null;
      return { occurrence: o, startCol: Math.max(0, daysBetween(weekStart, s)), endCol: Math.min(6, daysBetween(weekStart, en)) };
    })
    .filter((x): x is { occurrence: AgendaOccurrence; startCol: number; endCol: number } => x !== null)
    .sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);

  const laneEnds: number[] = [];
  const bars: WeekBar[] = [];
  const overflowByDay = new Map<string, number>();
  for (const item of relevant) {
    let lane = laneEnds.findIndex((end) => end < item.startCol);
    if (lane === -1) lane = laneEnds.length;
    if (lane >= MAX_WEEK_LANES) {
      for (let col = item.startCol; col <= item.endCol; col++) {
        const key = dateKey(week[col]);
        overflowByDay.set(key, (overflowByDay.get(key) ?? 0) + 1);
      }
      continue;
    }
    laneEnds[lane] = item.endCol;
    bars.push({ ...item, lane });
  }
  const laneCount = bars.reduce((max, b) => Math.max(max, b.lane + 1), 0);
  return { bars, laneCount, overflowByDay };
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
  const updateEvent = useUpdateAgendaEvent(ownerId);

  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultDate, setDialogDefaultDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<(AgendaEvent & { participantIds: string[] }) | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [activeOccurrence, setActiveOccurrence] = useState<AgendaOccurrence | null>(null);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    // Un glisser-déposer d'événement en cours utilise le même geste tactile qu'un swipe de
    // changement de mois (voir handleDragStart/handleDragEnd) : ne pas changer de mois en plus.
    if (!start || activeOccurrence) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + (dx < 0 ? 1 : -1), 1));
  }

  // Déplace un événement (ou toute une série récurrente, voir recurrence.ts) d'un jour à l'autre
  // par glisser-déposer — conserve l'heure et la durée, ne fait que décaler les deux dates du même
  // nombre de jours. Fonctionne à la souris (PointerSensor) comme au doigt (TouchSensor).
  function handleDragStart(e: DragStartEvent) {
    const occurrence = visibleOccurrences.find((o) => o.occurrenceKey === String(e.active.id)) ?? null;
    setActiveOccurrence(occurrence);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveOccurrence(null);
    const overId = e.over?.id;
    if (!overId) return;
    const sourceDayKey = e.active.data.current?.dayKey as string | undefined;
    const targetDayKey = String(overId);
    if (!sourceDayKey || sourceDayKey === targetDayKey) return;
    const eventId = String(e.active.id).split("::")[0];
    const original = eventsById.get(eventId);
    if (!original) return;
    const delta = daysBetween(new Date(`${sourceDayKey}T00:00:00`), new Date(`${targetDayKey}T00:00:00`));
    const shift = (iso: string) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + delta);
      return d.toISOString();
    };
    updateEvent.mutate({
      id: original.id,
      title: original.title,
      description: original.description,
      location: original.location,
      start_at: shift(original.start_at),
      end_at: original.end_at ? shift(original.end_at) : null,
      all_day: original.all_day,
      participantPersonIds: participantsByEvent.get(original.id) ?? [],
      recurrence_freq: original.recurrence_freq,
      recurrence_interval: original.recurrence_interval,
      recurrence_end_date: original.recurrence_end_date,
    });
  }

  const participantsByEvent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of participants ?? []) {
      const list = map.get(p.event_id) ?? [];
      list.push(p.person_id);
      map.set(p.event_id, list);
    }
    return map;
  }, [participants]);

  // Pour retrouver la définition d'origine d'une occurrence (id partagé par toutes les
  // occurrences d'une même série) quand on ouvre le dialogue d'édition — jamais les dates
  // décalées de l'occurrence cliquée, toujours l'ancre de la série.
  const eventsById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e])), [events]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const weeks = useMemo(() => {
    const chunks: Date[][] = [];
    for (let i = 0; i < grid.length; i += 7) chunks.push(grid.slice(i, i + 7));
    return chunks;
  }, [grid]);

  // Occurrences (dérivées de la récurrence) qui recoupent la grille affichée — un événement
  // récurrent (anniversaire, virement mensuel...) apparaît autant de fois que nécessaire, sans
  // matérialiser une ligne par occurrence en base (voir features/agenda/recurrence.ts).
  const visibleOccurrences = useMemo(() => {
    const rangeStart = grid[0];
    const rangeEnd = grid[grid.length - 1];
    return (events ?? []).flatMap((e) => expandEventOccurrences(e, rangeStart, rangeEnd));
  }, [events, grid]);

  // Une occurrence qui dure plusieurs jours doit apparaître dans CHAQUE case qu'elle couvre (pas
  // seulement le jour de début) — on parcourt donc la plage start_at → end_at jour par jour.
  // Plafond de sécurité à 366 jours pour ne jamais boucler indéfiniment sur une donnée aberrante.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaOccurrence[]>();
    for (const o of visibleOccurrences) {
      const startDay = startOfDay(new Date(o.start_at));
      const endDay = startOfDay(new Date(o.end_at ?? o.start_at));
      const cursor = new Date(startDay);
      let guard = 0;
      while (cursor.getTime() <= endDay.getTime() && guard < 366) {
        const key = dateKey(cursor);
        map.set(key, [...(map.get(key) ?? []), o]);
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
    }
    return map;
  }, [visibleOccurrences]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const rangeEnd = new Date(now);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);
    return (events ?? [])
      .flatMap((e) => expandEventOccurrences(e, now, rangeEnd))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 8);
  }, [events]);

  function openCreateDialog(day: Date) {
    setEditingEvent(null);
    setDialogDefaultDate(day);
    setDialogOpen(true);
  }

  // Reçoit potentiellement une occurrence (dates décalées) : on édite toujours la définition
  // d'origine de la série, jamais les dates recalculées d'une occurrence précise.
  function openEditDialog(occurrenceOrEvent: AgendaEvent) {
    const original = eventsById.get(occurrenceOrEvent.id) ?? occurrenceOrEvent;
    setEditingEvent({ ...original, participantIds: participantsByEvent.get(original.id) ?? [] });
    setDialogDefaultDate(null);
    setDialogOpen(true);
  }

  const selectedDayEvents = selectedDay ? eventsByDay.get(dateKey(selectedDay)) ?? [] : [];

  return (
    <div className="max-w-7xl space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div
          className="space-y-3 rounded-lg border border-border bg-card p-3"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => {
                setPickerYear(month.getFullYear());
                setPickerOpen(true);
              }}
              className="rounded-md px-2 py-1 text-sm font-semibold capitalize transition-colors hover:bg-secondary"
              title="Choisir un autre mois ou une autre année"
            >
              {MONTH_FORMATTER.format(month)}
            </button>
            <Button variant="ghost" size="icon" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold text-muted-foreground">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-1">
              {weeks.map((week, wi) => {
                const { bars, laneCount, overflowByDay } = layoutWeekBars(week, visibleOccurrences);
                const cellMinHeight = 26 + Math.max(laneCount, 1) * 30;
                return (
                  <div key={wi} className="relative">
                    <div className="grid grid-cols-7 gap-1">
                      {week.map((day) => (
                        <DayCell
                          key={day.toISOString()}
                          day={day}
                          inMonth={day.getMonth() === month.getMonth()}
                          isToday={isSameDay(day, new Date())}
                          overflow={overflowByDay.get(dateKey(day)) ?? 0}
                          minHeight={cellMinHeight}
                          onClick={() => setSelectedDay(day)}
                        />
                      ))}
                    </div>
                    {bars.length > 0 && (
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-7 gap-1 pt-[22px]"
                        style={{ gridAutoRows: "30px" }}
                      >
                        {bars.map((b) => (
                          <EventBar
                            key={b.occurrence.occurrenceKey}
                            occurrence={b.occurrence}
                            solidClass={combinationDotColorClass(participantsByEvent.get(b.occurrence.id) ?? [], people ?? [])}
                            gridColumn={`${b.startCol + 1} / ${b.endCol + 2}`}
                            gridRow={b.lane + 1}
                            draggable={canWrite}
                            onOpen={() => openEditDialog(b.occurrence)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <DragOverlay>
              {activeOccurrence && (
                <div
                  className={cn(
                    "flex max-w-[8rem] items-center gap-0.5 truncate rounded px-1.5 py-0.5 text-[0.65rem] font-semibold leading-tight text-white shadow-lg",
                    combinationDotColorClass(participantsByEvent.get(activeOccurrence.id) ?? [], people ?? [])
                  )}
                >
                  {activeOccurrence.recurrence_freq !== "none" && <Repeat className="h-2.5 w-2.5 flex-shrink-0" />}
                  <span className="truncate">{activeOccurrence.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Prochains événements</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rien de prévu pour l'instant.</p>
          ) : (
            <div className="space-y-1.5">
              {upcoming.map((e) => (
                <EventRow
                  key={e.occurrenceKey}
                  event={e}
                  people={people ?? []}
                  participantIds={participantsByEvent.get(e.id) ?? []}
                  onOpen={() => openEditDialog(e)}
                />
              ))}
            </div>
          )}
        </div>
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
                  key={e.occurrenceKey}
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

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Aller à un mois</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setPickerYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold">{pickerYear}</p>
            <Button variant="ghost" size="icon" onClick={() => setPickerYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => i).map((monthIndex) => {
              const isCurrent = pickerYear === month.getFullYear() && monthIndex === month.getMonth();
              return (
                <Button
                  key={monthIndex}
                  type="button"
                  variant={isCurrent ? "default" : "outline"}
                  className="capitalize"
                  onClick={() => {
                    setMonth(new Date(pickerYear, monthIndex, 1));
                    setPickerOpen(false);
                  }}
                >
                  {MONTH_SHORT_FORMATTER.format(new Date(pickerYear, monthIndex, 1))}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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

/** Case d'un jour de la grille — zone "droppable" (dnd-kit) pour y déposer un événement glissé
 * depuis un autre jour, en plus d'ouvrir la liste du jour au clic. */
function DayCell({
  day,
  inMonth,
  isToday,
  overflow,
  minHeight,
  onClick,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  overflow: number;
  minHeight: number;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey(day) });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      style={{ minHeight: `${minHeight}px` }}
      className={cn(
        "flex flex-col items-start rounded-md border p-1 text-left transition-colors",
        inMonth ? "border-border/60 bg-background" : "border-transparent bg-muted/30 text-muted-foreground",
        isToday && "border-accent",
        isOver && "border-accent bg-accent/10 ring-2 ring-accent"
      )}
    >
      <span className={cn("text-xs", isToday && "font-bold text-accent")}>{day.getDate()}</span>
      {overflow > 0 && <span className="mt-auto text-[0.6rem] font-medium text-muted-foreground">+{overflow}</span>}
    </button>
  );
}

/** Barre d'une occurrence dans la grille — "draggable" (dnd-kit) pour la déplacer d'un jour à
 * l'autre à la souris comme au doigt (voir sensors dans AgendaPage). Le clic (sans glisser) ouvre
 * toujours l'édition, grâce au seuil de déplacement des sensors (distance/delay). */
function EventBar({
  occurrence,
  solidClass,
  gridColumn,
  gridRow,
  draggable,
  onOpen,
}: {
  occurrence: AgendaOccurrence;
  solidClass: string;
  gridColumn: string;
  gridRow: number;
  draggable: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: occurrence.occurrenceKey,
    data: { dayKey: dateKey(new Date(occurrence.start_at)) },
    disabled: !draggable,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen();
      }}
      title={occurrence.title}
      className={cn(
        "pointer-events-auto flex items-start gap-0.5 overflow-hidden rounded px-1.5 py-0.5 text-left text-[0.65rem] font-semibold leading-snug text-white shadow-sm",
        solidClass,
        isDragging && "opacity-30",
        draggable && "cursor-grab touch-none active:cursor-grabbing"
      )}
      style={{ gridColumn, gridRow }}
      {...attributes}
      {...listeners}
    >
      {occurrence.recurrence_freq !== "none" && <Repeat className="mt-0.5 h-2.5 w-2.5 flex-shrink-0" />}
      <span className="line-clamp-2 break-words">{occurrence.title}</span>
    </button>
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
  const peopleById = new Map(people.map((p) => [p.id, p]));
  // Minuit pile est traité comme "heure non renseignée" (valeur par défaut d'un ajout rapide
  // depuis une case du calendrier) plutôt qu'une heure volontairement choisie — la distinction
  // n'existe pas en base, mais un événement réellement prévu à minuit pile est en pratique
  // inexistant pour un agenda personnel.
  const hasTime = !event.all_day && (start.getHours() !== 0 || start.getMinutes() !== 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md border border-border/60 bg-card p-2.5 text-left hover:bg-secondary"
    >
      <div className="flex w-14 flex-shrink-0 flex-col items-center text-xs text-muted-foreground">
        <span>{formatDate(dateKey(start))}</span>
        {hasTime && <span>{TIME_FORMATTER.format(start)}</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex items-center gap-1 truncate text-sm font-medium">
          {event.recurrence_freq !== "none" && <Repeat className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
          <span className="truncate">{event.title}</span>
        </p>
        {event.location && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" /> {event.location}
          </p>
        )}
      </div>
      {participantIds.length > 0 && (
        <div className="flex flex-shrink-0 flex-col items-center gap-1">
          <div className="flex -space-x-2">
            {participantIds.slice(0, 4).map((pid, i) => {
              const person = peopleById.get(pid);
              if (!person) return null;
              return (
                <PersonAvatarBadge
                  key={pid}
                  name={person.name}
                  avatarEmoji={person.avatar_emoji}
                  avatarConfig={person.avatar_config}
                  personId={person.id}
                  index={i}
                  colorIndex={personColorIndex(person.id, people)}
                  className="h-6 w-6 flex-shrink-0 border-2 border-card text-xs"
                />
              );
            })}
            {participantIds.length > 4 && (
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted text-[0.6rem] font-medium text-muted-foreground">
                +{participantIds.length - 4}
              </span>
            )}
          </div>
          {/* Même couleur que la barre de cet événement dans le calendrier (combinaison de
           * participants, pas juste le premier) — pour reconnaître d'un coup d'œil quel
           * événement de la grille correspond à cette ligne. */}
          <span className={cn("h-2 w-2 rounded-full", combinationDotColorClass(participantIds, people))} />
        </div>
      )}
    </button>
  );
}
