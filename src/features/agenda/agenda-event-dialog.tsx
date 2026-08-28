import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { usePeople } from "@/features/people/use-people";
import { personDotColorClass } from "@/features/agenda/person-color";
import { RECURRENCE_FREQ_LABELS, RECURRENCE_UNIT_LABELS } from "@/features/agenda/recurrence";
import { DatePickerButton } from "@/features/agenda/date-picker-button";
import {
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useDeleteAgendaEvent,
  type AgendaEventInput,
} from "@/features/agenda/use-agenda";
import type { AgendaEvent, RecurrenceFreq } from "@/types/database";
import { Trash2, X } from "lucide-react";

const RECURRENCE_FREQS: RecurrenceFreq[] = ["none", "daily", "weekly", "monthly", "yearly"];

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convertit un AgendaEvent (timestamptz ISO) vers les champs du formulaire, en local — inverse
 * de toIso() ci-dessous. */
function toDateTimeLocal(iso: string): string {
  return formatDateTimeLocal(new Date(iso));
}

function toDateOnly(iso: string): string {
  return toDateTimeLocal(iso).slice(0, 10);
}

function toIso(dateValue: string, allDay: boolean): string {
  return allDay ? new Date(`${dateValue}T00:00:00`).toISOString() : new Date(dateValue).toISOString();
}

function parseFormValue(value: string, allDay: boolean): Date {
  return new Date(allDay ? `${value}T00:00:00` : value);
}

function startOfCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Découpe la valeur combinée (date seule, ou "date+heure" au format datetime-local) en ses deux
 * parties — le DatePickerButton et le champ Heure les éditent séparément, mais l'état interne
 * reste la même chaîne combinée qu'avant (aucun changement dans toIso/computeDurationDays). */
function datePart(v: string): string {
  return v.slice(0, 10);
}

function timePart(v: string): string {
  return v.length > 10 ? v.slice(11, 16) : "09:00";
}

function withDatePart(v: string, date: string, allDay: boolean): string {
  return allDay ? date : `${date}T${v ? timePart(v) : "09:00"}`;
}

function withTimePart(v: string, time: string): string {
  const date = v ? datePart(v) : formatDateTimeLocal(new Date()).slice(0, 10);
  return `${date}T${time}`;
}

/** Nombre de jours couverts par l'événement (1 = un seul jour), dérivé de Début/Fin — pas un état
 * séparé à synchroniser, juste une lecture pratique des deux champs existants. */
function computeDurationDays(start: string, end: string, allDay: boolean): number {
  if (!start) return 1;
  const s = parseFormValue(start, allDay);
  const e = end ? parseFormValue(end, allDay) : s;
  const diff = Math.round((startOfCalendarDay(e).getTime() - startOfCalendarDay(s).getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

/** Recalcule Fin à partir de Début + un nombre de jours (1 = même jour, donc pas de Fin
 * explicite) — conserve l'heure de Début pour un événement non "Toute la journée". */
function applyDurationDays(start: string, allDay: boolean, days: number): string {
  const s = parseFormValue(start, allDay);
  s.setDate(s.getDate() + Math.max(1, days) - 1);
  return allDay ? formatDateTimeLocal(s).slice(0, 10) : formatDateTimeLocal(s);
}

export function AgendaEventDialog({
  ownerId,
  open,
  editingEvent,
  defaultDate,
  onOpenChange,
}: {
  ownerId: string;
  open: boolean;
  editingEvent: (AgendaEvent & { participantIds: string[] }) | null;
  defaultDate: Date | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: people } = usePeople();
  const createEvent = useCreateAgendaEvent(ownerId);
  const updateEvent = useUpdateAgendaEvent(ownerId);
  const deleteEvent = useDeleteAgendaEvent(ownerId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq>("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingEvent) {
      setTitle(editingEvent.title);
      setDescription(editingEvent.description ?? "");
      setLocation(editingEvent.location ?? "");
      setAllDay(editingEvent.all_day);
      setStart(editingEvent.all_day ? toDateOnly(editingEvent.start_at) : toDateTimeLocal(editingEvent.start_at));
      setEnd(editingEvent.end_at ? (editingEvent.all_day ? toDateOnly(editingEvent.end_at) : toDateTimeLocal(editingEvent.end_at)) : "");
      setParticipantIds(new Set(editingEvent.participantIds));
      setRecurrenceFreq(editingEvent.recurrence_freq);
      setRecurrenceInterval(editingEvent.recurrence_interval);
      setRecurrenceEndDate(editingEvent.recurrence_end_date ?? "");
    } else {
      const base = defaultDate ?? new Date();
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(false);
      setStart(toDateTimeLocal(base.toISOString()));
      setEnd("");
      setParticipantIds(new Set());
      setRecurrenceFreq("none");
      setRecurrenceInterval(1);
      setRecurrenceEndDate("");
    }
  }, [open, editingEvent, defaultDate]);

  function handleDurationChange(value: string) {
    if (!start) return;
    const days = Math.max(1, Math.min(365, Math.round(Number(value)) || 1));
    setEnd(days <= 1 ? "" : applyDurationDays(start, allDay, days));
  }

  function toggleParticipant(personId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  async function handleSubmit() {
    if (!title.trim() || !start) return;
    const input: AgendaEventInput = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: toIso(start, allDay),
      end_at: end ? toIso(end, allDay) : null,
      all_day: allDay,
      participantPersonIds: [...participantIds],
      recurrence_freq: recurrenceFreq,
      recurrence_interval: recurrenceFreq === "none" ? 1 : Math.max(1, recurrenceInterval),
      recurrence_end_date: recurrenceFreq === "none" ? null : recurrenceEndDate || null,
    };
    if (editingEvent) await updateEvent.mutateAsync({ id: editingEvent.id, ...input });
    else await createEvent.mutateAsync(input);
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!editingEvent) return;
    await deleteEvent.mutateAsync(editingEvent.id);
    onOpenChange(false);
  }

  const submitting = createEvent.isPending || updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEvent ? "Modifier l'événement" : "Nouvel événement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agenda-title">Titre</Label>
            <Input id="agenda-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allDay}
              onCheckedChange={(c) => {
                const next = !!c;
                setAllDay(next);
                setStart((s) => (s ? (next ? s.slice(0, 10) : `${s.slice(0, 10)}T09:00`) : s));
                setEnd((s) => (s ? (next ? s.slice(0, 10) : `${s.slice(0, 10)}T10:00`) : s));
              }}
            />
            Toute la journée
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Début</Label>
              <DatePickerButton value={datePart(start)} onChange={(d) => setStart(withDatePart(start, d, allDay))} />
              {!allDay && (
                <Input
                  type="time"
                  aria-label="Heure de début"
                  value={timePart(start)}
                  onChange={(e) => setStart(withTimePart(start, e.target.value))}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Fin (optionnel)</Label>
              <div className="flex gap-1">
                <DatePickerButton
                  value={end ? datePart(end) : ""}
                  onChange={(d) => setEnd(withDatePart(end, d, allDay))}
                  placeholder="Aucune"
                  className="flex-1"
                />
                {end && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setEnd("")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!allDay && end && (
                <Input
                  type="time"
                  aria-label="Heure de fin"
                  value={timePart(end)}
                  onChange={(e) => setEnd(withTimePart(end, e.target.value))}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda-duration">Durée (jours)</Label>
            <Input
              id="agenda-duration"
              type="number"
              min={1}
              max={365}
              className="w-24"
              value={computeDurationDays(start, end, allDay)}
              onChange={(e) => handleDurationChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Ajuste automatiquement la date de fin.</p>
          </div>

          <div className="space-y-2">
            <Label>Répétition</Label>
            <Select value={recurrenceFreq} onValueChange={(v) => setRecurrenceFreq(v as RecurrenceFreq)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_FREQS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {RECURRENCE_FREQ_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recurrenceFreq !== "none" && (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="agenda-recurrence-interval">Tous les</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="agenda-recurrence-interval"
                      type="number"
                      min={1}
                      max={365}
                      className="w-20"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Math.max(1, Math.round(Number(e.target.value)) || 1))}
                    />
                    <span className="text-sm text-muted-foreground">{RECURRENCE_UNIT_LABELS[recurrenceFreq]}</span>
                  </div>
                </div>
                <div className="min-w-[9rem] space-y-2">
                  <Label>Jusqu'au (optionnel)</Label>
                  <DatePickerButton value={recurrenceEndDate} onChange={setRecurrenceEndDate} placeholder="Sans fin" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda-location">Lieu</Label>
            <Input id="agenda-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda-description">Description</Label>
            <Textarea id="agenda-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Participants</Label>
            {(people ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune personne dans le répertoire (page Personnes).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(people ?? []).map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleParticipant(p.id)}
                    className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-sm transition-colors ${
                      participantIds.has(p.id) ? "border-accent bg-accent/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <PersonAvatarBadge
                      name={p.name}
                      avatarEmoji={p.avatar_emoji}
                      avatarConfig={p.avatar_config}
                      personId={p.id}
                      index={i}
                      colorIndex={p.color_index}
                      className="h-5 w-5 text-[0.65rem]"
                    />
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${personDotColorClass(p.id, people ?? [])}`} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {editingEvent && editingEvent.recurrence_freq !== "none" && (
          <p className="text-xs text-muted-foreground">
            Événement récurrent — modifier ou supprimer agit sur toute la série, pas seulement cette occurrence.
          </p>
        )}
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {editingEvent ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSubmit} disabled={!title.trim() || !start || submitting}>
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
