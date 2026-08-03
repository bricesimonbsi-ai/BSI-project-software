import { useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateEtape, useUpdateEtape } from "@/features/voyages/use-etapes";
import { CLIMATE_COLOR_CLASS, MONTH_LABELS, TRANSPORT_MODE_OPTIONS } from "@/features/voyages/itinerary/itinerary-model";
import { CountryPicker } from "@/features/voyages/itinerary/location-pickers";
import { cn } from "@/lib/utils";
import type { ClimateRating, VoyageEtape } from "@/types/database";
import { Plus } from "lucide-react";

const RATING_CYCLE: ClimateRating[] = ["good", "mid", "bad"];

export function EtapeDialog({
  voyageId,
  nextOrder,
  existing,
  trigger,
}: {
  voyageId: string;
  nextOrder: number;
  existing?: VoyageEtape;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [countryRegion, setCountryRegion] = useState(existing?.country_region ?? "");
  const [arrivalDate, setArrivalDate] = useState(existing?.arrival_date ?? "");
  const [durationDays, setDurationDays] = useState(existing?.duration_days?.toString() ?? "");
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
  const createEtape = useCreateEtape(voyageId);
  const updateEtape = useUpdateEtape(voyageId);

  function cycleMonth(index: number) {
    setClimate((prev) => {
      const next = [...prev];
      const currentIndex = RATING_CYCLE.indexOf(next[index]);
      next[index] = RATING_CYCLE[(currentIndex + 1) % RATING_CYCLE.length];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      country_region: countryRegion,
      arrival_date: arrivalDate || null,
      duration_days: durationDays ? Number(durationDays) : null,
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
      } else {
        await createEtape.mutateAsync({ ...payload, order_index: nextOrder });
        setCountryRegion("");
        setArrivalDate("");
        setDurationDays("");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle étape
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier l'étape" : "Nouvelle étape (pays/région)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pays / région</Label>
            <CountryPicker
              value={countryRegion}
              onChange={setCountryRegion}
              onSelect={(name, lat, lng) => {
                setCountryRegion(name);
                setLatitude(String(lat));
                setLongitude(String(lng));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date d'arrivée</Label>
              <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Durée (jours)</Label>
              <Input type="number" min="0" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
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
          <div className="flex items-center gap-2">
            <Checkbox checked={visaNeeded} onCheckedChange={(c) => setVisaNeeded(!!c)} id="visa" />
            <Label htmlFor="visa">Visa nécessaire</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={intlPermitNeeded} onCheckedChange={(c) => setIntlPermitNeeded(!!c)} id="permit" />
            <Label htmlFor="permit">Permis international nécessaire</Label>
          </div>
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
          <div className="space-y-2">
            <Label>Climat recommandé par mois (clique pour changer : favorable / moyen / déconseillé)</Label>
            <div className="flex overflow-hidden rounded-md">
              {climate.map((rating, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => cycleMonth(i)}
                  title={MONTH_LABELS[i]}
                  className={cn("h-8 flex-1 text-[0.65rem] font-semibold", CLIMATE_COLOR_CLASS[rating])}
                >
                  {MONTH_LABELS[i]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Infos sécurité</Label>
            <Textarea value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes libres</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
