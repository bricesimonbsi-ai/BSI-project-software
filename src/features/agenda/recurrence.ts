import type { AgendaEvent, RecurrenceFreq } from "@/types/database";

export const RECURRENCE_FREQ_LABELS: Record<RecurrenceFreq, string> = {
  none: "Aucune",
  daily: "Chaque jour",
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
  yearly: "Chaque année",
};

/** Unité affichée à côté du champ "Tous les N ...", accordée au singulier/pluriel côté appelant. */
export const RECURRENCE_UNIT_LABELS: Record<Exclude<RecurrenceFreq, "none">, string> = {
  daily: "jour(s)",
  weekly: "semaine(s)",
  monthly: "mois",
  yearly: "an(s)",
};

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Avance une date d'un pas de récurrence, en préservant l'heure. Pour "mensuel"/"annuel", cale le
 * jour sur le dernier jour du mois cible s'il déborde (ex. 31 janvier + 1 mois → 28/29 février,
 * jamais mars) plutôt que de laisser Date rouler naturellement sur le mois suivant. */
export function addRecurrenceInterval(date: Date, freq: RecurrenceFreq, interval: number): Date {
  const n = Math.max(1, Number.isFinite(interval) ? interval : 1);
  const d = new Date(date);
  switch (freq) {
    case "daily":
      d.setDate(d.getDate() + n);
      return d;
    case "weekly":
      d.setDate(d.getDate() + n * 7);
      return d;
    case "monthly": {
      const day = d.getDate();
      const targetIndex = d.getMonth() + n;
      const targetYear = d.getFullYear() + Math.floor(targetIndex / 12);
      const targetMonth = ((targetIndex % 12) + 12) % 12;
      d.setFullYear(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
      return d;
    }
    case "yearly": {
      const day = d.getDate();
      const targetYear = d.getFullYear() + n;
      d.setFullYear(targetYear, d.getMonth(), Math.min(day, daysInMonth(targetYear, d.getMonth())));
      return d;
    }
    default:
      return d;
  }
}

/** Occurrence dérivée d'un événement (récurrent ou non) — mêmes champs que l'événement d'origine,
 * mais start_at/end_at reflètent cette occurrence précise. `occurrenceKey` est unique par
 * occurrence (l'`id` reste celui de l'événement source : éditer/supprimer agit sur toute la
 * série, pas sur une occurrence isolée — pas de gestion d'exceptions dans cette itération). */
export type AgendaOccurrence = AgendaEvent & { occurrenceKey: string };

const MAX_OCCURRENCES = 5000;

const VALID_FREQS = new Set<RecurrenceFreq>(["daily", "weekly", "monthly", "yearly"]);

/** Dérive les occurrences d'un événement qui recoupent [rangeStart, rangeEnd]. Pour un événement
 * non récurrent, c'est juste l'événement lui-même (0 ou 1 résultat). Toute valeur de
 * recurrence_freq non reconnue (colonne pas encore migrée en base → undefined/null côté client,
 * ou donnée invalide) est traitée comme "none" plutôt que de partir dans la branche récurrente —
 * sinon addRecurrenceInterval ne fait rien sur une fréquence inconnue et la boucle pousse des
 * milliers de fois la même occurrence (événements "démultipliés" à l'affichage). */
export function expandEventOccurrences(event: AgendaEvent, rangeStart: Date, rangeEnd: Date): AgendaOccurrence[] {
  if (!VALID_FREQS.has(event.recurrence_freq)) {
    const s = new Date(event.start_at);
    const e = new Date(event.end_at ?? event.start_at);
    if (e < rangeStart || s > rangeEnd) return [];
    return [{ ...event, occurrenceKey: event.id }];
  }

  const durationMs = event.end_at ? new Date(event.end_at).getTime() - new Date(event.start_at).getTime() : 0;
  const seriesEnd = event.recurrence_end_date ? new Date(`${event.recurrence_end_date}T23:59:59`) : null;

  const occurrences: AgendaOccurrence[] = [];
  let occStart = new Date(event.start_at);
  let guard = 0;
  while (guard < MAX_OCCURRENCES) {
    guard += 1;
    if (seriesEnd && occStart > seriesEnd) break;
    if (occStart > rangeEnd) break;
    const occEnd = new Date(occStart.getTime() + durationMs);
    if (occEnd >= rangeStart) {
      occurrences.push({
        ...event,
        start_at: occStart.toISOString(),
        end_at: event.end_at ? occEnd.toISOString() : null,
        occurrenceKey: `${event.id}::${occStart.toISOString()}`,
      });
    }
    const next = addRecurrenceInterval(occStart, event.recurrence_freq, event.recurrence_interval);
    if (next.getTime() <= occStart.getTime()) break; // garde-fou : la date n'avance plus
    occStart = next;
  }
  return occurrences;
}
