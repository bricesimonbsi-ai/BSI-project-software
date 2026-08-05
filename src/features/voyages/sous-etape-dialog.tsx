import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSousEtape, useUpdateSousEtape, useInsertSousEtapeAt, useDeleteSousEtape } from "@/features/voyages/use-sous-etapes";
import { useSousEtapeExpenses, ETAPE_CATEGORIES } from "@/features/voyages/use-expenses";
import { TRANSPORT_MODE_OPTIONS, haversineDistanceKm } from "@/features/voyages/itinerary/itinerary-model";
import { CityPicker, findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { ClimateMonthPicker } from "@/features/voyages/itinerary/climate-month-picker";
import { ExpenseFormFields } from "@/features/voyages/expense-form-fields";
import { ExpenseList } from "@/features/voyages/expense-list";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { estimateClimateByMonth } from "@/features/voyages/itinerary/climate-suggest";
import { estimateCityPlannedCosts, type CityPlannedCosts } from "@/features/voyages/cost-of-living";
import { toast } from "@/hooks/use-toast";
import type { ClimateRating, TravelStyle, VoyageEtape, VoyageSousEtape } from "@/types/database";
import { Plus, Trash2, Sparkles } from "lucide-react";

export function SousEtapeDialog({
  etapeId,
  etape,
  nextOrder,
  existing,
  trigger,
  previousPoint,
  previousRowId,
  insertAtIndex,
  isFirstOverall,
  projectId,
  referenceCurrency,
  travelStyle,
  travelerCount,
  lodgingCount,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  etapeId: string;
  /** Étape (pays) parente — fournit le pays pour le sélecteur de ville et les taux de coût de
   * la vie (avec ses éventuels overrides manuels) utilisés pour les estimations prévisionnelles. */
  etape: VoyageEtape;
  nextOrder: number;
  existing?: VoyageSousEtape;
  trigger?: ReactNode | null;
  previousPoint?: { lat: number; lng: number } | null;
  previousRowId?: string;
  insertAtIndex?: number;
  /** Vrai uniquement pour la toute première ville de l'ensemble de l'itinéraire (l'ancre) :
   * c'est la seule dont la date de début est librement modifiable ici. Pour toutes les autres,
   * la date se déduit automatiquement de la ville précédente (voir l'auto-guérison dans
   * ItineraryView) — seul le nombre de nuits reste éditable. */
  isFirstOverall?: boolean;
  /** Nécessaires pour les sections dépenses (personnes à rattacher, devise, estimations). */
  projectId?: string;
  referenceCurrency?: string;
  travelStyle?: TravelStyle;
  travelerCount?: number;
  lodgingCount?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const countryCode = findCountryByName(etape.country_region)?.cca2;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [city, setCity] = useState(existing?.city ?? "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [nights, setNights] = useState(existing?.duration_days?.toString() ?? "");
  const [lodging, setLodging] = useState(existing?.lodging ?? "");
  const [activities, setActivities] = useState(existing?.activities ?? "");
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km?.toString() ?? "");
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() ?? "");
  const [transportMode, setTransportMode] = useState(existing?.transport_next_mode ?? "");
  const [useCityClimate, setUseCityClimate] = useState(existing?.climate_by_month != null);
  const [cityClimate, setCityClimate] = useState<ClimateRating[]>(existing?.climate_by_month ?? Array(12).fill("good"));
  const [suggestingClimate, setSuggestingClimate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [plannedCosts, setPlannedCosts] = useState<CityPlannedCosts>({ transport: 0, lodging: 0, food: 0 });
  const createSousEtape = useCreateSousEtape(etapeId);
  const updateSousEtape = useUpdateSousEtape(etapeId);
  const insertSousEtapeAt = useInsertSousEtapeAt(etapeId);
  const updateAnySousEtape = useUpdateSousEtape(etapeId);
  const deleteSousEtape = useDeleteSousEtape(etapeId);
  const { data: onSiteExpenses } = useSousEtapeExpenses(existing?.id);
  const plannedTransport = (onSiteExpenses ?? []).find((e) => e.planned && e.category === "transport");
  const plannedLodging = (onSiteExpenses ?? []).find((e) => e.planned && e.category === "logement");
  const plannedFood = (onSiteExpenses ?? []).find((e) => e.planned && e.category === "nourriture");
  const plannedActivities = (onSiteExpenses ?? []).find((e) => e.planned && e.category === "activites");
  const structuredExpenseIds = new Set(
    [plannedTransport?.id, plannedLodging?.id, plannedFood?.id, plannedActivities?.id].filter((id): id is string => !!id)
  );
  const otherExpenses = (onSiteExpenses ?? []).filter((e) => !structuredExpenseIds.has(e.id));

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const result = await estimateCityPlannedCosts({
        nights: Number(nights) || existing?.duration_days || 0,
        distanceKm: distanceKm ? Number(distanceKm) : null,
        transportMode: transportMode || null,
        countryCode: countryCode ?? null,
        style: travelStyle ?? "standard",
        travelerCount: travelerCount ?? 1,
        lodgingCount: lodgingCount ?? 1,
        lodgingOverride: etape.lodging_cost_per_night,
        foodOverride: etape.food_cost_per_day,
      });
      if (!cancelled) setPlannedCosts(result);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [nights, existing?.duration_days, distanceKm, transportMode, countryCode, travelStyle, travelerCount, lodgingCount, etape.lodging_cost_per_night, etape.food_cost_per_day]);

  async function handleSuggestClimate(latOverride?: number, lonOverride?: number) {
    const lat = latOverride ?? Number(latitude);
    const lon = lonOverride ?? Number(longitude);
    if (!lat || !lon) return;
    setSuggestingClimate(true);
    try {
      const suggested = await estimateClimateByMonth(lat, lon);
      setCityClimate(suggested);
      setUseCityClimate(true);
      toast({
        title: "Climat suggéré",
        description: "Basé sur l'historique météo réel (Open-Meteo) pour cette ville précisément, à ajuster si besoin.",
      });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSuggestingClimate(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Seule l'ancre (toute première ville de l'itinéraire) a une date de début libre : tout
    // le reste ne doit exposer que le nombre de nuits, la date étant déduite automatiquement
    // (voir l'auto-guérison dans ItineraryView) pour garantir la continuité du calendrier.
    const datePayload = isFirstOverall
      ? {
          start_date: startDate || null,
          end_date: endDate || null,
          duration_days:
            startDate && endDate
              ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
              : existing?.duration_days ?? null,
        }
      : { duration_days: nights ? Number(nights) : existing?.duration_days ?? null };
    const payload = {
      city,
      ...datePayload,
      lodging: lodging || null,
      activities: activities || null,
      distance_km: distanceKm ? Number(distanceKm) : null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      climate_by_month: useCityClimate ? cityClimate : null,
      transport_next_mode: transportMode || null,
    };
    try {
      if (existing) {
        await updateSousEtape.mutateAsync({ id: existing.id, ...payload });
      } else if (insertAtIndex !== undefined) {
        await insertSousEtapeAt.mutateAsync({ ...payload, atIndex: insertAtIndex });
      } else {
        await createSousEtape.mutateAsync({ ...payload, order_index: nextOrder });
      }
      if (!existing) {
        setCity("");
        setStartDate("");
        setEndDate("");
        setNights("");
        setLodging("");
        setActivities("");
        setDistanceKm("");
        setLatitude("");
        setLongitude("");
        setTransportMode("");
        setUseCityClimate(false);
        setCityClimate(Array(12).fill("good"));
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    if (!window.confirm(`Supprimer la ville "${existing.city}" ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await deleteSousEtape.mutateAsync(existing.id);
      setOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Ville
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier la sous-étape" : "Nouvelle sous-étape (ville)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ville</Label>
              <CityPicker
                value={city}
                onChange={setCity}
                countryCode={countryCode}
                onSelect={(name, lat, lon) => {
                  setCity(name);
                  setLatitude(String(lat));
                  setLongitude(String(lon));
                  if (previousPoint && previousRowId) {
                    updateAnySousEtape.mutate({
                      id: previousRowId,
                      distance_km: haversineDistanceKm(previousPoint.lat, previousPoint.lng, lat, lon),
                    });
                  }
                  handleSuggestClimate(lat, lon);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
              </div>
            </div>
          </div>
          {isFirstOverall ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Arrivée</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Départ</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Nombre de nuits</Label>
              <Input type="number" min="0" value={nights} onChange={(e) => setNights(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Les dates d'arrivée et de départ se déduisent automatiquement de la ville précédente dans l'itinéraire
                (visible dans le tableau) — seule la toute première ville du voyage a une date fixée manuellement.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            La distance depuis l'étape précédente est calculée automatiquement (visible dans le tableau) à partir des
            coordonnées GPS choisies via le champ Ville ci-dessus.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={useCityClimate} onCheckedChange={(c) => setUseCityClimate(!!c)} id="cityClimate" />
                <Label htmlFor="cityClimate">Climat propre à cette ville (sinon celui du pays)</Label>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => handleSuggestClimate()} disabled={suggestingClimate}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {suggestingClimate ? "Analyse..." : "Suggérer (Open-Meteo)"}
              </Button>
            </div>
            {useCityClimate && (
              <>
                <ClimateMonthPicker value={cityClimate} onChange={setCityClimate} />
                <p className="text-xs text-muted-foreground">
                  Suggéré automatiquement dès le choix de la ville, d'après l'historique météo réel des 5 dernières
                  années (Open-Meteo) sur ses coordonnées GPS précises — plus fin que le climat du pays.
                </p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logement (texte libre ou lien)</Label>
              <Textarea value={lodging} onChange={(e) => setLodging(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Activités prévues</Label>
              <Textarea value={activities} onChange={(e) => setActivities(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Transport vers l'étape suivante</Label>
            <Select value={transportMode} onValueChange={setTransportMode}>
              <SelectTrigger>
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {existing && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Dépenses prévisionnelles pour cette ville</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">Transport (vers la suivante)</Label>
                  <EditableExpenseAmount
                    scope={{ sousEtapeId: existing.id }}
                    category="transport"
                    subCategory={transportMode || null}
                    planned
                    existing={plannedTransport}
                    estimate={plannedCosts.transport}
                    referenceCurrency={referenceCurrency ?? "EUR"}
                    invalidateKey={["sous-etape-expenses", existing.id]}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">Logement</Label>
                  <EditableExpenseAmount
                    scope={{ sousEtapeId: existing.id }}
                    category="logement"
                    planned
                    existing={plannedLodging}
                    estimate={plannedCosts.lodging}
                    referenceCurrency={referenceCurrency ?? "EUR"}
                    invalidateKey={["sous-etape-expenses", existing.id]}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">Nourriture</Label>
                  <EditableExpenseAmount
                    scope={{ sousEtapeId: existing.id }}
                    category="nourriture"
                    planned
                    existing={plannedFood}
                    estimate={plannedCosts.food}
                    referenceCurrency={referenceCurrency ?? "EUR"}
                    invalidateKey={["sous-etape-expenses", existing.id]}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">Activités</Label>
                  <EditableExpenseAmount
                    scope={{ sousEtapeId: existing.id }}
                    category="activites"
                    planned
                    existing={plannedActivities}
                    estimate={0}
                    referenceCurrency={referenceCurrency ?? "EUR"}
                    invalidateKey={["sous-etape-expenses", existing.id]}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pré-rempli automatiquement à partir du coût de la vie du pays et de la distance vers la ville suivante ;
                ajuste librement chaque montant — ces mêmes lignes sont aussi modifiables depuis le tableau détaillé de
                l'onglet Budget (une modification d'un côté se reflète immédiatement de l'autre).
              </p>
            </div>
          )}
          {existing && (
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Dépenses réelles (saisies au fil du voyage)</Label>
                {!addingExpense && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setAddingExpense(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Dépense
                  </Button>
                )}
              </div>
              {addingExpense && (
                <div className="rounded-md border border-border p-3">
                  <ExpenseFormFields
                    scope={{ sousEtapeId: existing.id }}
                    categories={ETAPE_CATEGORIES}
                    referenceCurrency={referenceCurrency ?? "EUR"}
                    invalidateKey={["sous-etape-expenses", existing.id]}
                    projectId={projectId}
                    defaultPlanned={false}
                    onDone={() => setAddingExpense(false)}
                    onCancel={() => setAddingExpense(false)}
                  />
                </div>
              )}
              <ExpenseList
                expenses={otherExpenses}
                invalidateKey={["sous-etape-expenses", existing.id]}
                projectId={projectId}
                categories={ETAPE_CATEGORIES}
                referenceCurrency={referenceCurrency ?? "EUR"}
                inline
              />
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {existing ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Suppression..." : "Supprimer cette ville"}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
