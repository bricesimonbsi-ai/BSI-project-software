import { useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSousEtape, useUpdateSousEtape } from "@/features/voyages/use-sous-etapes";
import { TRANSPORT_MODE_OPTIONS, haversineDistanceKm } from "@/features/voyages/itinerary/itinerary-model";
import { CityPicker } from "@/features/voyages/itinerary/location-pickers";
import type { VoyageSousEtape } from "@/types/database";
import { Plus } from "lucide-react";

export function SousEtapeDialog({
  etapeId,
  nextOrder,
  existing,
  trigger,
  previousPoint,
}: {
  etapeId: string;
  nextOrder: number;
  existing?: VoyageSousEtape;
  trigger?: ReactNode;
  previousPoint?: { lat: number; lng: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState(existing?.city ?? "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [lodging, setLodging] = useState(existing?.lodging ?? "");
  const [activities, setActivities] = useState(existing?.activities ?? "");
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km?.toString() ?? "");
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() ?? "");
  const [transportMode, setTransportMode] = useState(existing?.transport_next_mode ?? "");
  const [transportDuration, setTransportDuration] = useState(existing?.transport_next_duration_hours?.toString() ?? "");
  const [transportCost, setTransportCost] = useState(existing?.transport_next_cost?.toString() ?? "");
  const [transportCurrency, setTransportCurrency] = useState(existing?.transport_next_currency ?? "");
  const [submitting, setSubmitting] = useState(false);
  const createSousEtape = useCreateSousEtape(etapeId);
  const updateSousEtape = useUpdateSousEtape(etapeId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const durationDays =
      startDate && endDate
        ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
        : existing?.duration_days ?? null;
    const payload = {
      city,
      start_date: startDate || null,
      end_date: endDate || null,
      duration_days: durationDays,
      lodging: lodging || null,
      activities: activities || null,
      distance_km: distanceKm ? Number(distanceKm) : null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      transport_next_mode: transportMode || null,
      transport_next_duration_hours: transportDuration ? Number(transportDuration) : null,
      transport_next_cost: transportCost ? Number(transportCost) : null,
      transport_next_currency: transportCurrency || null,
    };
    try {
      if (existing) {
        await updateSousEtape.mutateAsync({ id: existing.id, ...payload });
      } else {
        await createSousEtape.mutateAsync({ ...payload, order_index: nextOrder });
        setCity("");
        setStartDate("");
        setEndDate("");
        setLodging("");
        setActivities("");
        setDistanceKm("");
        setLatitude("");
        setLongitude("");
        setTransportMode("");
        setTransportDuration("");
        setTransportCost("");
        setTransportCurrency("");
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
          <Button size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Ville
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier la sous-étape" : "Nouvelle sous-étape (ville)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Ville</Label>
            <CityPicker
              value={city}
              onChange={setCity}
              onSelect={(name, lat, lon) => {
                setCity(name);
                setLatitude(String(lat));
                setLongitude(String(lon));
                if (previousPoint) {
                  setDistanceKm(String(haversineDistanceKm(previousPoint.lat, previousPoint.lng, lat, lon)));
                }
              }}
            />
          </div>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Distance depuis l'étape précédente (km)</Label>
              <Input type="number" step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logement (texte libre ou lien)</Label>
            <Textarea value={lodging} onChange={(e) => setLodging(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Activités prévues</Label>
            <Textarea value={activities} onChange={(e) => setActivities(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Transport vers l'étape suivante</Label>
            <div className="grid grid-cols-3 gap-2">
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
              <Input
                placeholder="Durée (h)"
                type="number"
                step="0.5"
                value={transportDuration}
                onChange={(e) => setTransportDuration(e.target.value)}
              />
              <Input placeholder="Coût" type="number" step="0.01" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} />
            </div>
            <Input
              placeholder="Devise du coût de transport"
              value={transportCurrency}
              onChange={(e) => setTransportCurrency(e.target.value.toUpperCase())}
              maxLength={3}
            />
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
