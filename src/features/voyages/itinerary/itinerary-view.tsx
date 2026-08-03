import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { useEtapes, useInsertEtapeAt } from "@/features/voyages/use-etapes";
import {
  useVoyageSousEtapes,
  useInsertSousEtapeAt,
  useReorderSousEtapes,
  useUpdateSousEtape,
} from "@/features/voyages/use-sous-etapes";
import {
  buildFlatRows,
  groupByCountry,
  cascadeDatesFrom,
  CLIMATE_COLOR_CLASS,
  MONTH_LABELS,
  type FlatRow,
  type CountryGroup,
} from "@/features/voyages/itinerary/itinerary-model";
import { MapView } from "@/features/voyages/itinerary/map-view";
import { CarbonDashboard } from "@/features/voyages/itinerary/carbon-dashboard";
import { EtapeDialog } from "@/features/voyages/etape-dialog";
import { SousEtapeDialog } from "@/features/voyages/sous-etape-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { VoyageSousEtape } from "@/types/database";

type Tab = "climat" | "dates" | "carte" | "carbone";

export function ItineraryView({
  voyageId,
  referenceCurrency,
}: {
  voyageId: string;
  referenceCurrency: string;
}) {
  const [tab, setTab] = useState<Tab>("dates");
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const insertEtapeAt = useInsertEtapeAt(voyageId);

  const sousEtapesByEtape = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    return map;
  }, [allSousEtapes]);

  const flat = useMemo(() => buildFlatRows(etapes ?? [], sousEtapesByEtape), [etapes, sousEtapesByEtape]);
  const groups = useMemo(() => groupByCountry(flat), [flat]);

  async function handleInsertCountry(atIndex: number) {
    try {
      await insertEtapeAt.mutateAsync({ atIndex, country_region: "Nouveau pays" });
      toast({ title: "Pays ajouté", description: "Clique dessus pour renseigner ses informations." });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="climat">Tableau climatique</TabsTrigger>
          <TabsTrigger value="dates">Mode dates</TabsTrigger>
          <TabsTrigger value="carte">Carte</TabsTrigger>
          <TabsTrigger value="carbone">Bilan carbone</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "carte" && <MapView groups={groups} />}
      {tab === "carbone" && <CarbonDashboard groups={groups} />}

      {(tab === "climat" || tab === "dates") && (
        <div className="relative overflow-x-auto rounded-md border border-border pl-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-2 py-2 text-center">Étape</th>
                <th className="px-2 py-2">Destination</th>
                <th className="px-2 py-2">Distance / transport</th>
                {tab === "dates" && (
                  <>
                    <th className="px-2 py-2">Du</th>
                    <th className="px-2 py-2">Au</th>
                    <th className="px-2 py-2">Nuits</th>
                  </>
                )}
                {tab === "climat" && <th className="px-2 py-2">Climat</th>}
              </tr>
              {tab === "climat" && (
                <tr className="border-b border-border">
                  <td colSpan={3}></td>
                  <td className="px-2 py-1">
                    <div className="flex">
                      {MONTH_LABELS.map((m, i) => (
                        <span key={i} className="flex-1 text-center text-[0.62rem] font-semibold text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </thead>
            <tbody>
              <AddButton onClick={() => handleInsertCountry(0)} colSpan={tab === "dates" ? 6 : 4} />
              {groups.map((group, gi) => (
                <CountryBlock
                  key={group.etape.id}
                  group={group}
                  tab={tab}
                  referenceCurrency={referenceCurrency}
                  onInsertCountryAfter={() => handleInsertCountry(group.etape.order_index + 1)}
                  isLast={gi === groups.length - 1}
                  allFlat={flat}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddButton({ onClick, colSpan }: { onClick: () => void; colSpan: number }) {
  return (
    <tr className="h-0 leading-none">
      <td className="relative h-2 w-10 p-0">
        <button
          onClick={onClick}
          title="Ajouter un pays ici"
          className="absolute -left-4 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-card text-[0.6rem] font-bold text-muted-foreground opacity-50 hover:opacity-100 hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-foreground"
        >
          +
        </button>
      </td>
      <td colSpan={colSpan - 1} className="p-0"></td>
    </tr>
  );
}

function CountryBlock({
  group,
  tab,
  referenceCurrency,
  onInsertCountryAfter,
  isLast,
  allFlat,
}: {
  group: CountryGroup;
  tab: Tab;
  referenceCurrency: string;
  onInsertCountryAfter: () => void;
  isLast: boolean;
  allFlat: FlatRow[];
}) {
  const insertCityAt = useInsertSousEtapeAt(group.etape.id);
  const reorderCities = useReorderSousEtapes(group.etape.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function handleInsertCity(atIndex: number) {
    try {
      await insertCityAt.mutateAsync({ atIndex, city: "Nouvelle ville" });
      toast({ title: "Ville ajoutée", description: "Clique dessus pour renseigner ses informations." });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = group.rows.map((r) => r.sousEtape.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    reorderCities.mutate(reordered);
  }

  const colSpan = tab === "dates" ? 6 : 4;

  return (
    <>
      <tr className="border-b border-border bg-accent/10 font-semibold">
        <td className="relative w-10 px-2 py-1.5 text-center">
          <Badge variant="secondary" className="text-[0.65rem]">
            {group.stepRangeLabel}
          </Badge>
        </td>
        <td className="px-2 py-1.5">
          <span className="inline-flex items-center gap-1">
            {group.etape.country_region}
            {group.etape.visa_needed && (
              <Badge variant="outline" className="text-[0.6rem]">
                Visa
              </Badge>
            )}
            {group.etape.vaccines && (
              <Badge variant="outline" className="text-[0.6rem]">
                {group.etape.vaccines}
              </Badge>
            )}
            {group.etape.intl_permit_needed && (
              <Badge variant="outline" className="text-[0.6rem]">
                Permis intl.
              </Badge>
            )}
            <EtapeDialog
              voyageId={group.etape.voyage_id}
              nextOrder={0}
              existing={group.etape}
              trigger={<Pencil className="h-3 w-3 cursor-pointer opacity-0 hover:opacity-100 group-hover:opacity-60" />}
            />
          </span>
        </td>
        <td className="px-2 py-1.5 text-xs font-bold">{group.totalKm > 0 ? `${Math.round(group.totalKm).toLocaleString("fr-FR")} km` : ""}</td>
        {tab === "dates" && (
          <>
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5 text-xs font-bold">{group.totalNights > 0 ? `${group.totalNights} nuits` : ""}</td>
          </>
        )}
        {tab === "climat" && <td className="px-2 py-1.5"></td>}
      </tr>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={group.rows.map((r) => r.sousEtape.id)} strategy={verticalListSortingStrategy}>
          {group.rows.map((row, ri) => (
            <CityRow
              key={row.sousEtape.id}
              row={row}
              tab={tab}
              referenceCurrency={referenceCurrency}
              etapeId={group.etape.id}
              allFlat={allFlat}
              onInsertAfter={() => handleInsertCity(row.sousEtape.order_index + 1)}
              hideAddButton={isLast && ri === group.rows.length - 1}
            />
          ))}
        </SortableContext>
      </DndContext>

      {!isLast && (
        <AddButtonRow colSpan={colSpan} onClick={onInsertCountryAfter} title="Ajouter un pays ici" />
      )}
    </>
  );
}

function AddButtonRow({ colSpan, onClick, title }: { colSpan: number; onClick: () => void; title: string }) {
  return (
    <tr className="h-0 leading-none">
      <td className="relative h-2 w-10 p-0">
        <button
          onClick={onClick}
          title={title}
          className="absolute -left-4 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-card text-[0.6rem] font-bold text-muted-foreground opacity-50 hover:opacity-100 hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-foreground"
        >
          +
        </button>
      </td>
      <td colSpan={colSpan - 1} className="p-0"></td>
    </tr>
  );
}

function CityRow({
  row,
  tab,
  referenceCurrency,
  etapeId,
  allFlat,
  onInsertAfter,
  hideAddButton,
}: {
  row: FlatRow;
  tab: Tab;
  referenceCurrency: string;
  etapeId: string;
  allFlat: FlatRow[];
  onInsertAfter: () => void;
  hideAddButton: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.sousEtape.id });
  const updateSousEtape = useUpdateSousEtape(etapeId);
  const se = row.sousEtape;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function handleNightsChange(delta: number) {
    const newDuration = Math.max(0, (se.duration_days ?? 0) + delta);
    const updates = cascadeDatesFrom(allFlat, se.id, { duration_days: newDuration });
    for (const u of updates) {
      await updateSousEtape.mutateAsync({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
    }
  }

  async function handleDateChange(field: "start_date" | "end_date", value: string) {
    if (field === "start_date") {
      const updates = cascadeDatesFrom(allFlat, se.id, { start_date: value });
      for (const u of updates) {
        await updateSousEtape.mutateAsync({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
      }
    } else {
      // Recalcule la durée à partir de la nouvelle date de fin, puis propage.
      const start = se.start_date ?? value;
      const days = Math.max(0, Math.round((new Date(value).getTime() - new Date(start).getTime()) / 86400000));
      const updates = cascadeDatesFrom(allFlat, se.id, { duration_days: days });
      for (const u of updates) {
        await updateSousEtape.mutateAsync({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
      }
    }
  }

  return (
    <tr ref={setNodeRef} style={style} className={cn("group border-b border-border last:border-0", isDragging && "opacity-50")}>
      <td className="relative w-10 px-2 py-1 text-center">
        {!hideAddButton && (
          <button
            onClick={onInsertAfter}
            title="Ajouter une ville ici"
            className="absolute -left-4 bottom-0 z-10 flex h-4 w-4 translate-y-1/2 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-card text-[0.6rem] font-bold text-muted-foreground opacity-50 hover:opacity-100 hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-foreground"
          >
            +
          </button>
        )}
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-60" title="Glisser pour réordonner">
          <GripVertical className="mx-auto h-3.5 w-3.5" />
        </button>
      </td>
      <td className="py-1 pl-6 pr-2">
        <span className="inline-flex items-center gap-1.5">
          {se.city}
          <SousEtapeDialog
            etapeId={etapeId}
            nextOrder={0}
            existing={se}
            trigger={<Pencil className="h-3 w-3 cursor-pointer opacity-0 group-hover:opacity-60" />}
          />
        </span>
      </td>
      <td className="px-2 py-1 text-xs text-muted-foreground">
        {row.incomingDistanceKm ? `${Math.round(row.incomingDistanceKm).toLocaleString("fr-FR")} km` : "—"}
        {row.incomingMode ? ` ${row.incomingMode}` : ""}
        {row.incomingCost ? ` · ${formatCurrency(row.incomingCost, row.incomingCostCurrency ?? referenceCurrency)}` : ""}
      </td>

      {tab === "dates" && (
        <>
          <td className="px-2 py-1">
            <input
              type="date"
              defaultValue={se.start_date ?? ""}
              onBlur={(e) => e.target.value && handleDateChange("start_date", e.target.value)}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
            />
          </td>
          <td className="px-2 py-1">
            <input
              type="date"
              defaultValue={se.end_date ?? ""}
              onBlur={(e) => e.target.value && handleDateChange("end_date", e.target.value)}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
            />
          </td>
          <td className="px-2 py-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
              <button
                onClick={() => handleNightsChange(-1)}
                className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-xs font-bold"
              >
                −
              </button>
              <span className="min-w-[3rem] text-center text-xs font-semibold">{se.duration_days ?? 0} nuits</span>
              <button
                onClick={() => handleNightsChange(1)}
                className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-xs font-bold"
              >
                +
              </button>
            </span>
          </td>
        </>
      )}

      {tab === "climat" && (
        <td className="min-w-[260px] px-2 py-1">
          <ClimateBand etape={se} row={row} />
        </td>
      )}
    </tr>
  );
}

function ClimateBand({ row }: { etape: VoyageSousEtape; row: FlatRow }) {
  const ratings = row.etape.climate_by_month ?? Array(12).fill("good");
  return (
    <div className="flex h-6 overflow-hidden rounded-sm">
      {ratings.map((r, i) => (
        <div key={i} className={cn("flex-1", CLIMATE_COLOR_CLASS[r] ?? "bg-muted")} />
      ))}
    </div>
  );
}
