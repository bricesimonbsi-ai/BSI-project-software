import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSousEtape, useUpdateSousEtape } from "@/features/voyages/use-sous-etapes";
import type { VoyageSousEtape } from "@/types/database";
import { Plus, Pencil } from "lucide-react";

export function SousEtapeDialog({
  etapeId,
  nextOrder,
  existing,
}: {
  etapeId: string;
  nextOrder: number;
  existing?: VoyageSousEtape;
}) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState(existing?.city ?? "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [lodging, setLodging] = useState(existing?.lodging ?? "");
  const [activities, setActivities] = useState(existing?.activities ?? "");
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
    const payload = {
      city,
      start_date: startDate || null,
      end_date: endDate || null,
      lodging: lodging || null,
      activities: activities || null,
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
        {existing ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
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
            <Input required value={city} onChange={(e) => setCity(e.target.value)} />
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
              <Input placeholder="Mode" value={transportMode} onChange={(e) => setTransportMode(e.target.value)} />
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
