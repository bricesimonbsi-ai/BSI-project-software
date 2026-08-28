import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { usePeople } from "@/features/people/use-people";
import { useAgendaEvents, useAgendaEventParticipants, useSharedAgendas } from "@/features/agenda/use-agenda";
import { combinationDotColorClass, personColorIndex } from "@/features/agenda/person-color";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { AgendaEventDialog } from "@/features/agenda/agenda-event-dialog";
import { AgendaCollaboratorsPanel } from "@/features/agenda/agenda-collaborators-panel";
import { expandEventOccurrences, type AgendaOccurrence } from "@/features/agenda/recurrence";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { formatDate, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Share2, MapPin, CalendarDays, Repeat } from "lucide-react";
import type { AgendaEvent, Person } from "@/types/database";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Seuil de déplacement horizontal (px) à partir duquel un geste tactile est traité comme un
 * swipe de changement de mois plutôt qu'un simple défilement vertical de la page. */
const SWIPE_THRESHOLD_PX = 50;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date): string {
  // Construit la clé à partir des composants locaux (pas toISOString, qui convertit en UTC et
  // décale d'un jour en arrière pour tout fuseau en avance sur UTC, ex. la France l'été).
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

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

  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultDate, setDialogDefaultDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<(AgendaEvent & { participantIds: string[] }) | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + (dx < 0 ? 1 : -1), 1));
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
    <div className="max-w-4xl space-y-6">
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

        <div className="space-y-1">
          {weeks.map((week, wi) => {
            const { bars, laneCount, overflowByDay } = layoutWeekBars(week, visibleOccurrences);
            const cellMinHeight = 26 + Math.max(laneCount, 1) * 20;
            return (
              <div key={wi} className="relative">
                <div className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const inMonth = day.getMonth() === month.getMonth();
                    const today = isSameDay(day, new Date());
                    const overflow = overflowByDay.get(dateKey(day)) ?? 0;
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        style={{ minHeight: `${cellMinHeight}px` }}
                        className={cn(
                          "flex flex-col items-start rounded-md border p-1 text-left transition-colors",
                          inMonth ? "border-border/60 bg-background" : "border-transparent bg-muted/30 text-muted-foreground",
                          today && "border-accent"
                        )}
                      >
                        <span className={cn("text-xs", today && "font-bold text-accent")}>{day.getDate()}</span>
                        {overflow > 0 && <span className="mt-auto text-[0.6rem] font-medium text-muted-foreground">+{overflow}</span>}
                      </button>
                    );
                  })}
                </div>
                {bars.length > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-7 gap-1 pt-[22px]"
                    style={{ gridAutoRows: "20px" }}
                  >
                    {bars.map((b) => {
                      const solidClass = combinationDotColorClass(participantsByEvent.get(b.occurrence.id) ?? [], people ?? []);
                      return (
                        <button
                          key={b.occurrence.occurrenceKey}
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEditDialog(b.occurrence);
                          }}
                          title={b.occurrence.title}
                          className={cn(
                            "pointer-events-auto flex items-center gap-0.5 truncate rounded px-1.5 text-[0.65rem] font-semibold leading-tight text-white shadow-sm",
                            solidClass
                          )}
                          style={{ gridColumn: `${b.startCol + 1} / ${b.endCol + 2}`, gridRow: b.lane + 1 }}
                        >
                          {b.occurrence.recurrence_freq !== "none" && <Repeat className="h-2.5 w-2.5 flex-shrink-0" />}
                          <span className="truncate">{b.occurrence.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
