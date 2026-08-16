import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { usePeople } from "@/features/people/use-people";
import { personDotColorClass } from "@/features/agenda/person-color";
import {
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useDeleteAgendaEvent,
  type AgendaEventInput,
} from "@/features/agenda/use-agenda";
import type { AgendaEvent } from "@/types/database";
import { Trash2 } from "lucide-react";

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
    } else {
      const base = defaultDate ?? new Date();
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(false);
      setStart(toDateTimeLocal(base.toISOString()));
      setEnd("");
      setParticipantIds(new Set());
    }
  }, [open, editingEvent, defaultDate]);

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
              <Label htmlFor="agenda-start">Début</Label>
              <Input id="agenda-start" type={allDay ? "date" : "datetime-local"} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-end">Fin (optionnel)</Label>
              <Input id="agenda-end" type={allDay ? "date" : "datetime-local"} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
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
