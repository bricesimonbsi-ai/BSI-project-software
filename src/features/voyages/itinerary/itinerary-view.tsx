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
import { GripVertical, Pencil, Plane, TrainFront, Bus, Car, Ship, MoveRight, Stamp, Syringe, IdCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEtapes, useInsertEtapeAt, useReorderEtapes } from "@/features/voyages/use-etapes";
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
  getPlannedMonthIndices,
  CLIMATE_COLOR_CLASS,
  MONTH_LABELS,
  type FlatRow,
  type CountryGroup,
} from "@/features/voyages/itinerary/itinerary-model";
import { MapView } from "@/features/voyages/itinerary/map-view";
import { getCountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { CarbonDashboard } from "@/features/voyages/itinerary/carbon-dashboard";
import { EtapeDialog } from "@/features/voyages/etape-dialog";
import { SousEtapeDialog } from "@/features/voyages/sous-etape-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { VoyageSousEtape } from "@/types/database";

type Tab = "climat" | "dates" | "carte" | "carbone";

/** Palette cyclique de couleurs par pays, pour distinguer visuellement chaque bandeau (façon maquette). */
const COUNTRY_COLOR_CLASSES = [
  "bg-emerald-500/10 border-l-4 border-l-emerald-500",
  "bg-amber-500/10 border-l-4 border-l-amber-500",
  "bg-rose-500/10 border-l-4 border-l-rose-500",
  "bg-sky-500/10 border-l-4 border-l-sky-500",
  "bg-violet-500/10 border-l-4 border-l-violet-500",
  "bg-orange-500/10 border-l-4 border-l-orange-500",
];

function transportIcon(mode: string | null) {
  if (!mode) return null;
  const m = mode.toLowerCase();
  if (m.includes("avion")) return Plane;
  if (m.includes("train")) return TrainFront;
  if (m.includes("bus")) return Bus;
  if (m.includes("voiture")) return Car;
  if (m.includes("ferry") || m.includes("bateau")) return Ship;
  return MoveRight;
}

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
  const reorderEtapes = useReorderEtapes(voyageId);
  const updateAnySousEtape = useUpdateSousEtape(voyageId);
  const countrySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  function handleCountryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = groups.map((g) => g.etape.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    reorderEtapes.mutate(reordered);

    // Reconstruit la séquence globale dans le nouvel ordre et relance la cascade de dates :
    // la toute première date de l'itinéraire (l'ancre) ne bouge jamais, tout le reste se recalcule.
    const groupById = new Map(groups.map((g) => [g.etape.id, g]));
    const newFlat = reordered.flatMap((id) => groupById.get(id)?.rows ?? []);
    const anchor = flat.find((r) => r.globalIndex === 1)?.sousEtape.start_date ?? undefined;
    if (newFlat.length > 0) {
      const updates = cascadeDatesFrom(newFlat, newFlat[0].sousEtape.id, anchor ? { start_date: anchor } : {});
      for (const u of updates) {
        updateAnySousEtape.mutate({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="climat">Tableau climatique</TabsTrigger>
            <TabsTrigger value="dates">Mode dates</TabsTrigger>
            <TabsTrigger value="carte">Carte</TabsTrigger>
            <TabsTrigger value="carbone">Bilan carbone</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          onClick={() => handleInsertCountry(groups.length > 0 ? groups[groups.length - 1].etape.order_index + 1 : 0)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nouveau pays
        </Button>
      </div>

      {tab === "carte" && <MapView groups={groups} />}
      {tab === "carbone" && <CarbonDashboard groups={groups} />}

      {(tab === "climat" || tab === "dates") && (
        <div className="relative overflow-x-auto rounded-md border border-border pl-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-14 px-3 py-3 text-center">Étape</th>
                <th className="px-3 py-3">Destination</th>
                {tab === "dates" && (
                  <>
                    <th className="px-3 py-3">Du</th>
                    <th className="px-3 py-3">Au</th>
                    <th className="px-3 py-3">Nuits</th>
                  </>
                )}
                {tab === "climat" && <th className="px-3 py-3">Climat</th>}
              </tr>
              {tab === "climat" && (
                <tr className="border-b border-border">
                  <td colSpan={2}></td>
                  <td className="px-3 py-2">
                    <div className="flex">
                      {MONTH_LABELS.map((m, i) => (
                        <span key={i} className="flex-1 text-center text-[0.7rem] font-semibold text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </thead>
            <tbody>
              <AddButton onClick={() => handleInsertCountry(0)} colSpan={tab === "dates" ? 5 : 3} />
              <DndContext sensors={countrySensors} collisionDetection={closestCenter} onDragEnd={handleCountryDragEnd}>
                <SortableContext items={groups.map((g) => g.etape.id)} strategy={verticalListSortingStrategy}>
                  {groups.map((group, colorIndex) => (
                    <CountryBlock
                      key={group.etape.id}
                      group={group}
                      tab={tab}
                      referenceCurrency={referenceCurrency}
                      onInsertCountryAfter={() => handleInsertCountry(group.etape.order_index + 1)}
                      allFlat={flat}
                      colorIndex={colorIndex}
                    />
                  ))}
                </SortableContext>
              </DndContext>
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
          className="absolute -left-4 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-card text-[0.65rem] font-bold text-muted-foreground opacity-50 hover:opacity-100 hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-foreground"
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
  allFlat,
  colorIndex,
}: {
  group: CountryGroup;
  tab: Tab;
  referenceCurrency: string;
  onInsertCountryAfter: () => void;
  allFlat: FlatRow[];
  colorIndex: number;
}) {
  const insertCityAt = useInsertSousEtapeAt(group.etape.id);
  const reorderCities = useReorderSousEtapes(group.etape.id);
  const updateSousEtapeForReorder = useUpdateSousEtape(group.etape.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const {
    attributes: countryAttributes,
    listeners: countryListeners,
    setNodeRef: setCountryNodeRef,
    transform: countryTransform,
    transition: countryTransition,
    isDragging: isCountryDragging,
  } = useSortable({ id: group.etape.id });
  const countryStyle = {
    transform: CSS.Transform.toString(countryTransform),
    transition: countryTransition,
  };

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

    // Reconstruit la séquence globale avec ce pays réordonné et relance la cascade de dates :
    // la toute première date de l'itinéraire (l'ancre) ne bouge jamais, tout le reste se recalcule.
    const idsInGroup = new Set(ids);
    const newFlat: FlatRow[] = [];
    let inserted = false;
    for (const r of allFlat) {
      if (idsInGroup.has(r.sousEtape.id)) {
        if (!inserted) {
          for (const id of reordered) {
            const match = group.rows.find((gr) => gr.sousEtape.id === id);
            if (match) newFlat.push(match);
          }
          inserted = true;
        }
      } else {
        newFlat.push(r);
      }
    }
    const anchor = allFlat.find((r) => r.globalIndex === 1)?.sousEtape.start_date ?? undefined;
    if (newFlat.length > 0) {
      const updates = cascadeDatesFrom(newFlat, newFlat[0].sousEtape.id, anchor ? { start_date: anchor } : {});
      for (const u of updates) {
        updateSousEtapeForReorder.mutate({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
      }
    }
  }

  const colSpan = tab === "dates" ? 5 : 3;

  return (
    <>
      <tr
        ref={setCountryNodeRef}
        style={countryStyle}
        className={cn(
          "group/country border-b border-border font-semibold",
          COUNTRY_COLOR_CLASSES[colorIndex % COUNTRY_COLOR_CLASSES.length],
          isCountryDragging && "opacity-50"
        )}
      >
        <td className="relative w-14 whitespace-nowrap px-3 py-3 text-center">
          <button
            {...countryAttributes}
            {...countryListeners}
            className="absolute -left-4 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground opacity-0 group-hover/country:opacity-60"
            title="Glisser pour réordonner le pays"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <Badge variant="secondary" className="whitespace-nowrap text-xs">
            {group.stepRangeLabel}
          </Badge>
        </td>
        <td className="px-3 py-3">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {getCountryFlag(group.etape.country_region) && (
              <span className="text-lg leading-none">{getCountryFlag(group.etape.country_region)}</span>
            )}
            {group.etape.country_region}
            {group.totalKm > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                · {Math.round(group.totalKm).toLocaleString("fr-FR")} km
              </span>
            )}
            {group.etape.visa_needed && (
              <Badge className="gap-1 border-blue-500/30 bg-blue-500/15 text-xs text-blue-700 dark:text-blue-300">
                <Stamp className="h-3 w-3" /> Visa
              </Badge>
            )}
            {group.etape.vaccines && (
              <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300">
                <Syringe className="h-3 w-3" /> {group.etape.vaccines}
              </Badge>
            )}
            {group.etape.intl_permit_needed && (
              <Badge className="gap-1 border-violet-500/30 bg-violet-500/15 text-xs text-violet-700 dark:text-violet-300">
                <IdCard className="h-3 w-3" /> Permis intl.
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
        {tab === "dates" && (
          <>
            <td className="px-3 py-3"></td>
            <td className="px-3 py-3"></td>
            <td className="px-3 py-3 text-sm font-bold">{group.totalNights > 0 ? `${group.totalNights} nuits` : ""}</td>
          </>
        )}
        {tab === "climat" && <td className="px-3 py-3"></td>}
      </tr>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={group.rows.map((r) => r.sousEtape.id)} strategy={verticalListSortingStrategy}>
          {group.rows.map((row) => (
            <CityRow
              key={row.sousEtape.id}
              row={row}
              tab={tab}
              referenceCurrency={referenceCurrency}
              etapeId={group.etape.id}
              allFlat={allFlat}
              onInsertAfter={() => handleInsertCity(row.sousEtape.order_index + 1)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <AddButtonRow colSpan={colSpan} onClick={onInsertCountryAfter} title="Ajouter un pays ici" />
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
          className="absolute -left-4 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-card text-[0.65rem] font-bold text-muted-foreground opacity-50 hover:opacity-100 hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-foreground"
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
}: {
  row: FlatRow;
  tab: Tab;
  referenceCurrency: string;
  etapeId: string;
  allFlat: FlatRow[];
  onInsertAfter: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.sousEtape.id });
  const updateSousEtape = useUpdateSousEtape(etapeId);
  const se = row.sousEtape;
  const previousRow = allFlat.find((r) => r.globalIndex === row.globalIndex - 1);
  const previousPoint =
    previousRow?.sousEtape.latitude != null && previousRow?.sousEtape.longitude != null
      ? { lat: previousRow.sousEtape.latitude, lng: previousRow.sousEtape.longitude }
      : null;
  const colSpan = tab === "dates" ? 5 : 3;

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

  /** Seule la toute première ville de l'itinéraire a une date de début librement éditable :
   * toutes les suivantes sont calculées (= date de fin de la précédente), ce qui rend tout
   * chevauchement de dates entre villes impossible par construction. */
  async function handleFirstStartDateChange(value: string) {
    const updates = cascadeDatesFrom(allFlat, se.id, { start_date: value });
    for (const u of updates) {
      await updateSousEtape.mutateAsync({ id: u.id, start_date: u.start_date, end_date: u.end_date, duration_days: u.duration_days });
    }
  }

  return (
    <>
      {row.globalIndex > 1 && (row.incomingDistanceKm || row.incomingMode) && (
        <TransitRow row={row} referenceCurrency={referenceCurrency} colSpan={colSpan} />
      )}
      <tr ref={setNodeRef} style={style} className={cn("group border-b border-border last:border-0", isDragging && "opacity-50")}>
      <td className="relative w-14 px-3 py-2.5 text-center">
        <button
          onClick={onInsertAfter}
          title="Ajouter une ville ici"
          className="absolute -left-4 bottom-0 z-10 flex h-4 w-4 translate-y-1/2 items-center justify-center rounded-full border border-dashed border-muted-foreground bg-card text-[0.65rem] font-bold text-muted-foreground opacity-50 hover:opacity-100 hover:border-solid hover:border-accent hover:bg-accent hover:text-accent-foreground"
        >
          +
        </button>
        <span className="text-xs font-medium text-muted-foreground">{row.globalIndex}</span>
        <button {...attributes} {...listeners} className="ml-1 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-60" title="Glisser pour réordonner">
          <GripVertical className="mx-auto h-3.5 w-3.5" />
        </button>
      </td>
      <td className="py-2.5 pl-6 pr-3">
        <span className="inline-flex items-center gap-1.5">
          {se.city}
          <SousEtapeDialog
            etapeId={etapeId}
            nextOrder={0}
            existing={se}
            previousPoint={previousPoint}
            countryName={row.etape.country_region}
            trigger={<Pencil className="h-3 w-3 cursor-pointer opacity-0 group-hover:opacity-60" />}
          />
        </span>
      </td>
      {tab === "dates" && (
        <>
          <td className="px-3 py-2">
            {row.globalIndex === 1 ? (
              <input
                type="date"
                defaultValue={se.start_date ?? ""}
                onBlur={(e) => e.target.value && handleFirstStartDateChange(e.target.value)}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
              />
            ) : (
              <span className="text-xs text-muted-foreground" title="Calculée automatiquement (= fin de la ville précédente)">
                {formatDate(se.start_date)}
              </span>
            )}
          </td>
          <td className="px-3 py-2">
            <span className="text-xs text-muted-foreground">{formatDate(se.end_date)}</span>
          </td>
          <td className="px-3 py-2">
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
        <td className="min-w-[300px] px-3 py-2">
          <ClimateBand etape={se} row={row} />
        </td>
      )}
      </tr>
    </>
  );
}

function TransitRow({
  row,
  referenceCurrency,
  colSpan,
}: {
  row: FlatRow;
  referenceCurrency: string;
  colSpan: number;
}) {
  const TransportIcon = transportIcon(row.incomingMode);
  return (
    <tr className="border-b border-dashed border-border/60 bg-muted/50">
      <td colSpan={colSpan} className="px-3 py-1 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center justify-center gap-1.5">
          {TransportIcon && <TransportIcon className="h-3.5 w-3.5 flex-shrink-0 text-sky-600 dark:text-sky-400" />}
          {row.incomingDistanceKm ? `${Math.round(row.incomingDistanceKm).toLocaleString("fr-FR")} km` : ""}
          {row.incomingCost ? ` · ${formatCurrency(row.incomingCost, row.incomingCostCurrency ?? referenceCurrency)}` : ""}
        </span>
      </td>
    </tr>
  );
}

function ClimateBand({ row }: { etape: VoyageSousEtape; row: FlatRow }) {
  const ratings = row.etape.climate_by_month ?? Array(12).fill("good");
  const planned = getPlannedMonthIndices(row.etape.arrival_date, row.etape.duration_days);
  return (
    <div className="flex h-7 overflow-hidden rounded-sm">
      {ratings.map((r, i) => (
        <div
          key={i}
          className={cn(
            "flex-1",
            CLIMATE_COLOR_CLASS[r] ?? "bg-muted",
            planned.has(i) && "ring-2 ring-inset ring-black dark:ring-white"
          )}
        />
      ))}
    </div>
  );
}
