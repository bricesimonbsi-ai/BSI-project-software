import { useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateEtape, useUpdateEtape, useInsertEtapeAt, useDeleteEtape } from "@/features/voyages/use-etapes";
import { useEtapeExpenses } from "@/features/voyages/use-expenses";
import { TRANSPORT_MODE_OPTIONS } from "@/features/voyages/itinerary/itinerary-model";
import { CountryFlag, CountryPicker } from "@/features/voyages/itinerary/location-pickers";
import { ClimateMonthPicker } from "@/features/voyages/itinerary/climate-month-picker";
import { estimateClimateByMonth } from "@/features/voyages/itinerary/climate-suggest";
import { estimateVisaCostEur } from "@/features/voyages/budget-estimate";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { toast } from "@/hooks/use-toast";
import type { ClimateRating, TravelStyle, VoyageEtape } from "@/types/database";
import { Plus, Trash2, Lock, Sparkles } from "lucide-react";

export function EtapeDialog({
  voyageId,
  nextOrder,
  existing,
  trigger,
  insertAtIndex,
  lockCountry,
  travelStyle,
  travelerCount,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  voyageId: string;
  nextOrder: number;
  existing?: VoyageEtape;
  trigger?: ReactNode | null;
  insertAtIndex?: number;
  /** Verrouille le champ pays quand des villes sont déjà associées à cette étape : changer de
   * pays sous des villes existantes n'a pas de sens (visa/climat/permis dépendent du pays). */
  lockCountry?: boolean;
  /** Nécessaires pour préremplir l'estimation du visa (EditableExpenseAmount). */
  travelStyle?: TravelStyle;
  travelerCount?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [countryRegion, setCountryRegion] = useState(existing?.country_region ?? "");
  const [visaNeeded, setVisaNeeded] = useState(existing?.visa_needed ?? false);
  const [vaccines, setVaccines] = useState(existing?.vaccines ?? "");
  const [transportMode, setTransportMode] = useState(existing?.transport_mode ?? "");
  const [intlPermitNeeded, setIntlPermitNeeded] = useState(existing?.intl_permit_needed ?? false);
  const [securityNotes, setSecurityNotes] = useState(existing?.security_notes ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() ?? "");
  const [climate, setClimate] = useState<ClimateRating[]>(existing?.climate_by_month ?? Array(12).fill("good"));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: etapeExpenses } = useEtapeExpenses(existing?.id);
  const plannedVisa = (etapeExpenses ?? []).find((e) => e.planned && e.category === "visas");
  const [suggestingClimate, setSuggestingClimate] = useState(false);
  const createEtape = useCreateEtape(voyageId);
  const updateEtape = useUpdateEtape(voyageId);
  const insertEtapeAt = useInsertEtapeAt(voyageId);
  const deleteEtape = useDeleteEtape(voyageId);

  async function handleSuggestClimate(latOverride?: number, lonOverride?: number) {
    const lat = latOverride ?? Number(latitude);
    const lon = lonOverride ?? Number(longitude);
    if (!lat || !lon) {
      toast({
        title: "Coordonnées manquantes",
        description: "Choisis d'abord le pays via la liste déroulante pour obtenir ses coordonnées GPS.",
        variant: "destructive",
      });
      return;
    }
    setSuggestingClimate(true);
    try {
      const suggested = await estimateClimateByMonth(lat, lon);
      setClimate(suggested);
      toast({ title: "Climat suggéré", description: "Basé sur l'historique météo réel (Open-Meteo), à ajuster si besoin." });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSuggestingClimate(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      country_region: countryRegion,
      visa_needed: visaNeeded,
      vaccines: vaccines || null,
      transport_mode: transportMode || null,
      intl_permit_needed: intlPermitNeeded,
      security_notes: securityNotes || null,
      notes: notes || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      climate_by_month: climate,
    };
    try {
      if (existing) {
        await updateEtape.mutateAsync({ id: existing.id, ...payload });
      } else if (insertAtIndex !== undefined) {
        await insertEtapeAt.mutateAsync({ ...payload, atIndex: insertAtIndex });
      } else {
        await createEtape.mutateAsync({ ...payload, order_index: nextOrder });
      }
      if (!existing) {
        setCountryRegion("");
        setVisaNeeded(false);
        setVaccines("");
        setTransportMode("");
        setIntlPermitNeeded(false);
        setSecurityNotes("");
        setNotes("");
        setLatitude("");
        setLongitude("");
        setClimate(Array(12).fill("good"));
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    if (!window.confirm(`Supprimer le pays "${existing.country_region}" et toutes ses villes ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await deleteEtape.mutateAsync(existing.id);
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
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle étape
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier l'étape" : "Nouvelle étape (pays/région)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pays / région</Label>
            {lockCountry ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                <CountryFlag name={countryRegion} className="text-base" />
                <span className="flex-1">{countryRegion}</span>
                <span title="Verrouillé : des villes sont déjà associées">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </div>
            ) : (
              <CountryPicker
                value={countryRegion}
                onChange={setCountryRegion}
                onSelect={(name, lat, lng) => {
                  setCountryRegion(name);
                  setLatitude(String(lat));
                  setLongitude(String(lng));
                  handleSuggestClimate(lat, lng);
                }}
              />
            )}
            {lockCountry && (
              <p className="text-xs text-muted-foreground">
                Le pays ne peut pas être changé tant que des villes sont associées à cette étape. Supprime d'abord toutes les
                villes pour pouvoir choisir un autre pays.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input type="number" step="0.000001" placeholder="ex. 48.8566" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input type="number" step="0.000001" placeholder="ex. 2.3522" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={visaNeeded} onCheckedChange={(c) => setVisaNeeded(!!c)} id="visa" />
              <Label htmlFor="visa">Visa nécessaire</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={intlPermitNeeded} onCheckedChange={(c) => setIntlPermitNeeded(!!c)} id="permit" />
              <Label htmlFor="permit">Permis international nécessaire</Label>
            </div>
          </div>
          {visaNeeded && existing && (
            <div className="space-y-1">
              <Label className="text-xs font-normal text-muted-foreground">Coût de visa prévisionnel (pour ce pays)</Label>
              <EditableExpenseAmount
                scope={{ etapeId: existing.id }}
                category="visas"
                planned
                existing={plannedVisa}
                estimate={estimateVisaCostEur(travelStyle ?? "standard", travelerCount ?? 1)}
                referenceCurrency="EUR"
                invalidateKey={["etape-expenses", existing.id]}
                className="w-32"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vaccins recommandés</Label>
              <Input value={vaccines} onChange={(e) => setVaccines(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mode de déplacement sur place</Label>
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un mode" />
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
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Climat recommandé par mois (clique pour changer : favorable / moyen / déconseillé)</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => handleSuggestClimate()} disabled={suggestingClimate}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {suggestingClimate ? "Analyse..." : "Suggérer (Open-Meteo)"}
              </Button>
            </div>
            <ClimateMonthPicker value={climate} onChange={setClimate} />
            <p className="text-xs text-muted-foreground">
              Suggéré automatiquement dès le choix du pays, d'après l'historique météo réel des 5 dernières années
              (Open-Meteo, gratuit, sans clé) — une estimation à ajuster si besoin, pas une prévision.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Infos sécurité</Label>
              <Textarea value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes libres</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {existing ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Suppression..." : "Supprimer ce pays"}
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
