import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { WEEKDAY_LABELS, MONTH_FORMATTER, buildMonthGrid, dateKey, isSameDay } from "@/features/agenda/calendar-utils";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";

/** Bouton qui ouvre un mini calendrier (pas de dépendance externe, même grille que la page
 * Agenda) — remplace le widget natif <input type="date">, dont le calendrier ne s'ouvre qu'en
 * cliquant précisément la petite icône, facile à manquer sur PC. */
export function DatePickerButton({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
}: {
  /** Date au format "YYYY-MM-DD", ou "" si aucune date choisie. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()));

  useEffect(() => {
    if (open) setViewMonth(value ? new Date(`${value}T00:00:00`) : new Date());
  }, [open, value]);

  const grid = buildMonthGrid(viewMonth);
  const today = new Date();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-start font-normal", className)}>
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          {value ? formatDate(value) : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-3">
        <div className="flex items-center justify-between pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold capitalize">{MONTH_FORMATTER.format(viewMonth)}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-semibold text-muted-foreground">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 pt-1">
          {grid.map((day) => {
            const inMonth = day.getMonth() === viewMonth.getMonth();
            const selected = value === dateKey(day);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  onChange(dateKey(day));
                  setOpen(false);
                }}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors hover:bg-secondary",
                  inMonth ? "text-foreground" : "text-muted-foreground/50",
                  isToday && !selected && "font-bold text-accent",
                  selected && "bg-accent font-semibold text-accent-foreground hover:bg-accent"
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
